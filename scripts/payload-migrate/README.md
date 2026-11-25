# Migração Directus → Payload CMS

Ferramenta de migração versionada, sem segredos e sem apagamento de dados.

- **Padrão é dry-run:** lê o Directus, mapeia para o contrato do Payload, conta e valida. Não grava nada.
- `apply` exige `--apply` explícito e continua sem `DELETE`: documentos existentes são reaproveitados pela chave natural.
- Nenhuma credencial fica no repositório; todas vêm do ambiente.
- Isto é código e teste versionado. **Nenhuma migração real foi executada** e nenhuma instância Payload foi validada.

## Coleções

Ordem de processamento: `category`, `purpose`, `location`, `property`, `submission`, `media`.

`users` não é criado pela ferramenta: crie as contas no Payload com os papéis `admin`, `editor`, `agent` e `service`, e passe um mapa `email → id` com `--users-map arquivo.json`. Nunca versionar esse arquivo.

## Variáveis obrigatórias

```sh
DIRECTUS_URL=https://directus.exemplo.com
DIRECTUS_TOKEN=<service-account-api-only>
PAYLOAD_URL=https://payload.exemplo.com
PAYLOAD_TOKEN=<api-key-da-colecao-users>
PAYLOAD_TENANT_ID=<id-da-empresa>
```

`PAYLOAD_TENANT_ID` identifica o site na instância única. Não é limite de usuário nem regra de isolamento.

## Uso

```sh
# 1. Somente leitura: contagens, amostra e problemas de mapeamento
node scripts/payload-migrate/index.mjs

# 2. Verificação após a importação (ainda sem gravação)
node scripts/payload-migrate/index.mjs --verify

# 3. Importação explícita, idempotente por chave natural
node scripts/payload-migrate/index.mjs --apply --users-map ./users-map.json
```

A saída é JSON. Um `issues` não vazio termina com código 1. `200` noPayload significa apenas que o documento foi aceito; não afirma imóvel publicado nem notificação entregue.

## Chaves naturais

| Coleção | Chave no Payload |
| --- | --- |
| `category`, `purpose` | `slug` |
| `location` | `city\|state\|neighborhood` |
| `property` | `code` |
| `submission` | `submission_key` |
| `media` | `legacyId` |

Relacionamentos são resolvidos por `legacyId` depois que a coleção pai é importada. Usuários são resolvidos pelo mapa `email → id`; sem mapa, `owner_id` fica `null` e o problema é relatado.

## Testes

```sh
node --check scripts/payload-migrate/index.mjs
node --test scripts/payload-migrate/*.test.mjs
```

Os testes injetam `fetch`: não chamam Directus, não chamam Payload e não precisam de segredos. O workflow `payload-migration.yml` executa isso no GitHub Actions.