# Deploy de sites estáticos em domínio próprio via Cloudflare

## Integracao com o wizard Vexora

Etapas do wizard (ver apps/web/src/app/sites/wizard/wizard-shell.tsx):
- Etapa "Dominio": chama `POST /sites/:id/domain` e `GET /sites/:id/domain/verify`.
- Etapa "Publicar": chama `POST /sites/:id/deploy` com os arquivos do SiteDocument renderizado.

## Abordagem escolhida: Cloudflare Pages (Direct Upload)

Comparação:
- **Cloudflare Pages (Direct Upload)**: projeto Pages + upload de arquivos via API (multipart + manifest de hashes). Suporta domínio customizado com SSL automático, CDN global, preview deployments. Limite 20.000 arquivos / 25 MiB por arquivo. **Escolhido**.
- **Workers + KV/R2**: mais flexível (rotas customizadas, lógica serverless), mas exige gerenciar assets no R2/KV e roteamento manual; maior complexidade e custo para site estático puro.

Justificativa: site estático puro, necessidade de domínio próprio com SSL automático e CDN global com mínimo de código. Pages Direct Upload oferece isso nativamente via REST API.

## Fluxo

1. Usuário informa domínio → `POST /sites/:id/domain` { domain, tenantId }
   - Cria projeto no Cloudflare Pages (nome derivado de tenantId + slug do site).
   - Vincula domínio customizado ao projeto.
   - Se a zona do domínio estiver na conta Cloudflare do usuário, cria registro CNAME automaticamente; caso contrário retorna instruções para criar manualmente: `domínio -> <projeto>.pages.dev`.
2. Verificação DNS/SSL → `GET /sites/:id/domain/verify` { tenantId }
   - Consulta status do domínio no Pages; quando `active`, marca domínio como ACTIVE e grava `verifiedAt`.
3. Deploy dos arquivos → `POST /sites/:id/deploy` { tenantId, files: [{ path, contentBase64 }] }
   - Calcula hash de conteúdo para idempotência.
   - Cria deployment via Direct Upload (manifest + arquivos).
   - Persiste status (QUEUED/UPLOADING/DEPLOYED/FAILED) e URL do deployment.

## Endpoints

- `POST /sites/:id/domain` — body `{ domain, tenantId }`
- `GET /sites/:id/domain/verify` — body `{ tenantId }`
- `POST /sites/:id/deploy` — body `{ tenantId, files: [{ path, contentBase64 }] }`

## Modelo de dados (Prisma)

Ver `packages/database/prisma/schema.prisma`: `Site`, `SiteDomain`, `SiteDeployment`.

## Variáveis de ambiente

- `CLOUDFLARE_API_TOKEN` — token com permissão Pages Edit (e DNS Edit se for criar registros).
- `CLOUDFLARE_ACCOUNT_ID` — ID da conta Cloudflare do usuário (modo "suas").

## Credenciais

Nunca hardcoded. Lidas via `ConfigService` (NestJS) a partir de variáveis de ambiente. Em produção, injetar via Vault/secret manager.

## Idempotência

- Domínio: upsert por `domain` (único). Re-vincular o mesmo domínio ao mesmo site não duplica.
- Deploy: hash SHA-256 do conteúdo; se já existe deployment DEPLOYED com o mesmo hash, retorna o existente (`idempotent: true`).

## Auth / tenant / permissões

Os controllers usam `tenantId` no body como placeholder. Em produção, substituir por guards reais do Véxora (JwtAuthGuard, TenantGuard, PermissionsGuard) e ler `tenantId` do contexto autenticado. O serviço já filtra por `tenantId` em todas as consultas (`findFirst where tenantId`).

## Limitações / não verificado

- O fluxo de Direct Upload via API usa manifest (path -> sha256) + partes multipart keyed pelo hash. Cloudflare pode exigir upload em duas etapas (retornando URLs de upload para hashes faltantes) em alguns casos; a implementação atual envia todos os arquivos em uma única requisição, adequado para sites pequenos. Para sites grandes, implementar a etapa de upload por hash.
- Não foi validado contra uma conta Cloudflare real (sem credenciais); usar ambiente de teste/dry-run.
- Jobs assíncronos (BullMQ) não implementados; deploy é síncrono. Adicionar fila para sites grandes.