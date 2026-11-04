# Diagnóstico de integridade multi-tenant

Este documento contém somente consultas de diagnóstico. Todas são SELECT: não criam índices, constraints, locks de escrita, correções automáticas ou alterações de dados.

## Escopo comprovado no schema atual

- conversations.tenant_id relaciona a conversa ao tenant, mas as relações com contacts e channel_connections usam somente o ID do registro.
- messages.tenant_id relaciona a mensagem ao tenant, mas a relação com conversations usa somente conversation_id.
- email_thread_key possui índice composto, sem unicidade composta.
- provider_message_id possui unicidade composta por tenant_id e valor não nulo, mas não inclui canal ou provedor.
- contacts permite mais de um registro com o mesmo e-mail no mesmo tenant.

Essas características não provam que existam dados inválidos. As consultas medem o estado antes de qualquer proposta de migration.

## Execução segura

1. Execute com uma conta de leitura e, quando possível, contra réplica ou snapshot.
2. Não remova, atualize ou deduplicate registros com base apenas nos resultados.
3. Preserve timestamp, ambiente, commit e contagens; não exponha conteúdo de mensagens nem credenciais.
4. Resultado vazio significa apenas que nenhum caso foi encontrado no momento da leitura.

## Consultas SQL read-only

### 1. Conversa e contato em tenants diferentes

~~~sql
SELECT c.id AS conversation_id,
       c.tenant_id AS conversation_tenant_id,
       ct.id AS contact_id,
       ct.tenant_id AS contact_tenant_id
FROM conversations AS c
JOIN contacts AS ct ON ct.id = c.contact_id
WHERE c.tenant_id <> ct.tenant_id
ORDER BY c.tenant_id, c.id;
~~~

### 2. Conversa e canal em tenants diferentes

~~~sql
SELECT c.id AS conversation_id,
       c.tenant_id AS conversation_tenant_id,
       cc.id AS channel_connection_id,
       cc.tenant_id AS channel_tenant_id
FROM conversations AS c
JOIN channel_connections AS cc ON cc.id = c.channel_connection_id
WHERE c.tenant_id <> cc.tenant_id
ORDER BY c.tenant_id, c.id;
~~~

Conversas sem canal não são divergência por si só e não aparecem na consulta.

### 3. Mensagem e conversa em tenants diferentes

~~~sql
SELECT m.id AS message_id,
       m.tenant_id AS message_tenant_id,
       c.id AS conversation_id,
       c.tenant_id AS conversation_tenant_id
FROM messages AS m
JOIN conversations AS c ON c.id = m.conversation_id
WHERE m.tenant_id <> c.tenant_id
ORDER BY m.tenant_id, m.id;
~~~

### 4. email_thread_key duplicada no escopo atual

~~~sql
SELECT tenant_id,
       channel_connection_id,
       email_thread_key,
       COUNT(*) AS conversation_count,
       ARRAY_AGG(id ORDER BY created_at, id) AS conversation_ids
FROM conversations
WHERE email_thread_key IS NOT NULL
  AND channel_connection_id IS NOT NULL
GROUP BY tenant_id, channel_connection_id, email_thread_key
HAVING COUNT(*) > 1
ORDER BY tenant_id, channel_connection_id, email_thread_key;
~~~

A duplicidade exige revisão. Não mescle conversas automaticamente.

### 5. Mesma thread em canais diferentes dentro do tenant

~~~sql
SELECT tenant_id,
       email_thread_key,
       COUNT(*) AS conversation_count,
       COUNT(DISTINCT channel_connection_id) AS channel_count,
       ARRAY_AGG(id ORDER BY created_at, id) AS conversation_ids
FROM conversations
WHERE email_thread_key IS NOT NULL
GROUP BY tenant_id, email_thread_key
HAVING COUNT(DISTINCT channel_connection_id) > 1
ORDER BY tenant_id, email_thread_key;
~~~

Pode ser legítimo quando há caixas distintas; é um sinal para confirmar o escopo esperado.

### 6. provider_message_id duplicado no mesmo tenant

~~~sql
SELECT tenant_id,
       provider_message_id,
       COUNT(*) AS message_count,
       ARRAY_AGG(id ORDER BY created_at, id) AS message_ids
FROM messages
WHERE provider_message_id IS NOT NULL
GROUP BY tenant_id, provider_message_id
HAVING COUNT(*) > 1
ORDER BY tenant_id, provider_message_id;
~~~

Com a constraint atual, o resultado deve ser vazio para valores não nulos. Resultado indica drift de schema, legado ou constraint ausente no ambiente consultado.

### 7. Mesmo identificador do provedor em tenants diferentes

~~~sql
SELECT provider_message_id,
       COUNT(*) AS message_count,
       COUNT(DISTINCT tenant_id) AS tenant_count,
       ARRAY_AGG(DISTINCT tenant_id ORDER BY tenant_id) AS tenant_ids
FROM messages
WHERE provider_message_id IS NOT NULL
GROUP BY provider_message_id
HAVING COUNT(DISTINCT tenant_id) > 1
ORDER BY provider_message_id;
~~~

Reuso entre tenants não é automaticamente violação: alguns provedores escopam o ID à conta ou conexão. O resultado orienta se a futura chave deve incluir canal ou provedor.

### 8. E-mail duplicado dentro do tenant

~~~sql
SELECT tenant_id,
       LOWER(BTRIM(email)) AS normalized_email,
       COUNT(*) AS contact_count,
       ARRAY_AGG(id ORDER BY created_at, id) AS contact_ids
FROM contacts
WHERE email IS NOT NULL
  AND BTRIM(email) <> ''
GROUP BY tenant_id, LOWER(BTRIM(email))
HAVING COUNT(*) > 1
ORDER BY tenant_id, normalized_email;
~~~

Não presume que e-mail seja identidade única: contatos podem compartilhar endereço.

### 9. Mailbox e canal em tenants diferentes

~~~sql
SELECT em.id AS mailbox_id,
       em.tenant_id AS mailbox_tenant_id,
       cc.id AS channel_connection_id,
       cc.tenant_id AS channel_tenant_id
FROM email_mailboxes AS em
JOIN channel_connections AS cc ON cc.id = em.channel_connection_id
WHERE em.tenant_id <> cc.tenant_id
ORDER BY em.tenant_id, em.id;
~~~

## Equivalentes Prisma

Prisma Client não expressa de forma portátil comparações entre duas colunas relacionadas. Use queryRaw com SQL estático e tipos explícitos para divergências:

~~~ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const conversationTenantMismatches = await prisma.$queryRaw<Array<{
  conversation_id: string;
  conversation_tenant_id: string;
  contact_id: string;
  contact_tenant_id: string;
}>>`
  SELECT c.id AS conversation_id, c.tenant_id AS conversation_tenant_id,
         ct.id AS contact_id, ct.tenant_id AS contact_tenant_id
  FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.tenant_id <> ct.tenant_id
`;

const messageTenantMismatches = await prisma.$queryRaw<Array<{
  message_id: string;
  message_tenant_id: string;
  conversation_id: string;
  conversation_tenant_id: string;
}>>`
  SELECT m.id AS message_id, m.tenant_id AS message_tenant_id,
         c.id AS conversation_id, c.tenant_id AS conversation_tenant_id
  FROM messages m JOIN conversations c ON c.id = m.conversation_id
  WHERE m.tenant_id <> c.tenant_id
`;

const duplicateThreadKeys = await prisma.$queryRaw<Array<{
  tenant_id: string;
  channel_connection_id: string;
  email_thread_key: string;
  conversation_count: bigint;
}>>`
  SELECT tenant_id, channel_connection_id, email_thread_key, COUNT(*) AS conversation_count
  FROM conversations
  WHERE email_thread_key IS NOT NULL AND channel_connection_id IS NOT NULL
  GROUP BY tenant_id, channel_connection_id, email_thread_key
  HAVING COUNT(*) > 1
`;
~~~

Para provider_message_id, Prisma groupBy é suficiente quando não há comparação entre colunas:

~~~ts
const duplicateProviderIds = await prisma.message.groupBy({
  by: ["tenantId", "providerMessageId"],
  where: { providerMessageId: { not: null } },
  _count: { _all: true },
  having: { providerMessageId: { _count: { gt: 1 } } },
});
~~~

Normalização de e-mail com LOWER(BTRIM(email)), comparação tenant-a-tenant e COUNT(DISTINCT ...) devem continuar em queryRaw. Nunca interpolar nomes, colunas ou SQL vindo de entrada do usuário.

## Critério para futura mudança de schema

Nenhuma constraint deve ser adicionada apenas porque o schema permite divergência. Primeiro execute as consultas em cada ambiente, classifique cada linha, defina reparo reversível e auditado, confirme que a ingestão usa a mesma identidade e só então prepare migration com pré-validação.

Este documento não executa consultas e não altera schema, migrações, dados ou produção.

