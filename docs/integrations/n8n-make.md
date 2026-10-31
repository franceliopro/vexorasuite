# Integrações n8n e Make

A API pública da Véxora é por empresa. Cada empresa deve usar o próprio token; nunca reutilize o token de outra empresa.

## Credencial

- Base URL: `https://api.vexorasuite.com.br`
- Autenticação: `Authorization: Bearer <token-da-empresa>`
- Não coloque tokens em campos públicos, frontends ou mensagens de webhook.

Crie o token no painel administrativo da empresa e revogue-o quando deixar de ser necessário.

## Operações disponíveis

### Health check

```http
GET /api/public-api/v1/health
Authorization: Bearer <token-da-empresa>
```

### Listar conversas

```http
GET /api/public-api/v1/conversations?limit=20
Authorization: Bearer <token-da-empresa>
```

Use o cursor retornado pela API para buscar a próxima página. O módulo HTTP do Make e o node HTTP Request do n8n conseguem consumir esses endpoints sem código adicional.

## Webhooks

Cadastre um webhook no painel da empresa e use a URL gerada como:

- **n8n:** node **Webhook** com método POST;
- **Make:** módulo **Webhooks > Custom webhook**.

A Véxora assina cada entrega. Preserve os headers de assinatura, valide o corpo bruto antes de processar e responda rapidamente com HTTP 2xx. Eventos duplicados devem ser tratados pelo identificador da entrega.

Em caso de falha, a Véxora tenta novamente conforme a política de retentativas da assinatura. O fluxo externo deve ser idempotente.

## Fluxos recomendados

### Novo atendimento

1. Webhook da Véxora.
2. Filtro pelo evento e pela empresa.
3. Consulta da conversa pela API.
4. Roteamento para CRM, tarefa ou notificação.

### Follow-up

1. Webhook ou agendamento externo.
2. Consulta de conversas abertas.
3. Filtro por etapa, etiqueta ou tempo.
4. Envio para a ação aprovada no workflow da Véxora.

## Isolamento

Tokens, webhooks, conversas e resultados pertencem ao tenant que os criou. Se a API retornar `401` ou `403`, interrompa o fluxo e não tente substituir o token automaticamente.

Esta documentação descreve somente endpoints já disponíveis; novas ações serão adicionadas quando houver contrato público e testes de isolamento.
