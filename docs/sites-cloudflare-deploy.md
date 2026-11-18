# Sites em domínio próprio — Cloudflare Pages (Direct Upload)

Publicação de sites estáticos no **Cloudflare Pages da conta do próprio cliente**, com
domínio próprio e SSL gerenciado, sem criar uma implantação no Dokploy por site.

> Contexto: o produto Sites saiu do menu em 16/11 (PR #740), mas os modelos
> `Site`, `SitePage`, `SiteBlock`, `SiteItem` e `SiteAsset` continuam no banco.
> Este módulo usa esses dados e não depende do controller antigo.

## Por que Cloudflare Pages (e não Worker + KV/R2)

| Opção | Decisão | Motivo |
| --- | --- | --- |
| **Pages + Direct Upload via API** | ✅ escolhida | Feita para site estático: upload de arquivos, CDN global, SSL automático e domínio customizado nativo. Não exige runtime, banco ou binding por site. |
| Worker + KV/R2 | ❌ descartada | Exigiria um Worker por site (ou roteamento próprio), gravação/leitura em KV/R2, gestão de rotas e cache manual — complexidade operacional desnecessária para HTML/CSS/imagens. |
| Git integration do Pages | ❌ descartada | O conteúdo nasce no banco da Véxora, não em um repositório. Direct Upload publica exatamente os arquivos renderizados. |

## Fluxo oficial usado

Referências: [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/),
[Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/),
[API Pages](https://developers.cloudflare.com/api/resources/pages/),
[API DNS](https://developers.cloudflare.com/api/resources/dns/).

1. **Credencial** — a empresa cadastra `apiToken` + `accountId` da Cloudflare. O token é
   validado em `GET /user/tokens/verify` e gravado criptografado (AES-256-GCM, AAD =
   `tenantId`) em `tenants.integrations.cloudflare.apiToken`. Sem credencial da empresa,
   o servidor usa `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` como fallback.
2. **Projeto Pages** — `GET /accounts/{account_id}/pages/projects/{project}`; se não existir,
   `POST /accounts/{account_id}/pages/projects` com `{ name, production_branch: "main" }`.
   O nome é `<SITE_PAGES_PROJECT_PREFIX>-<slug-do-site>` (ex.: `vexora-site-clinica-vida`).
3. **Upload dos arquivos** (mesmo fluxo do `wrangler pages deploy`):
   - `POST /accounts/{account_id}/pages/projects/{project}/upload-token` → JWT de upload;
   - `POST /pages/assets/check-missing` (JWT) com os hashes SHA-256 dos arquivos;
   - `POST /pages/assets/upload` (JWT) com os arquivos faltantes em base64
     (`{ key: hash, value, metadata: { contentType }, base64: true }`, lotes de até
     500 arquivos / 40 MB);
   - `POST /pages/assets/upsert-hashes` (JWT).
4. **Deployment** — `POST /accounts/{account_id}/pages/projects/{project}/deployments`
   multipart com `manifest` (`{ "/index.html": "<sha256>", ... }`), `branch` e
   `commit_message`. A resposta traz `id`, `url` e `latest_stage.status`.
5. **Domínio customizado** — `POST /accounts/{account_id}/pages/projects/{project}/domains`
   com `{ "name": "www.cliente.com.br" }`. A resposta traz `status`
   (`initializing`/`pending`/`active`/`deactivated`/`blocked`/`error`) e
   `validation_data`/`verification_data`.
6. **DNS**
   - Zona na mesma conta Cloudflare: `GET /zones?name=<zona>` →
     `POST /zones/{zone_id}/dns_records` com CNAME `www → <project>.pages.dev`
     (proxied). Em apex (`cliente.com.br`), o Pages gerencia o registro.
   - Zona em outro provedor: a API devolve instruções; o cliente cria o CNAME.
7. **SSL** — emitido e renovado pelo Cloudflare Pages. Nenhum certificado é gerenciado
   pela Véxora. CAA do domínio pode bloquear a emissão (aparece como `blocked`/`error`).

## Endpoints

Todos exigem `Authorization: Bearer <access token>`; mutações exigem papel
`OWNER`, `ADMIN` ou `MANAGER`. Base: `/api`.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/sites/deploy/config` | Status da credencial Cloudflare (`source: tenant/server`, `accountId`, `projectPrefix`). |
| PUT | `/sites/deploy/config` | Body `{ apiToken, accountId }`; valida o token e grava criptografado. |
| DELETE | `/sites/deploy/config` | Remove o token da empresa (mantém o restante de `integrations`). |
| POST | `/sites/:siteId/deploy` | Body opcional `{ branch?, commitMessage?, force? }`. Renderiza, publica e devolve `{ deployment, reused, files, bytes }`. |
| GET | `/sites/:siteId/deployments?limit=20` | Histórico persistido (status, URL, arquivos, erro). |
| GET | `/sites/deploy/deployments/:deploymentId` | Detalhe de uma publicação. |
| POST | `/sites/deploy/deployments/:deploymentId/refresh` | Consulta o status atual na Cloudflare. |
| GET | `/sites/:siteId/domain` | Domínio atual + vínculo Cloudflare. |
| POST | `/sites/:siteId/domain` | Body `{ hostname }`: cria domínio no Pages, ajusta CNAME quando possível. |
| POST | `/sites/:siteId/domain/verify` | Relê o status/SSL na Cloudflare e atualiza `sites.domain_status`. |
| DELETE | `/sites/:siteId/domain` | Desvincula o domínio no Pages e limpa `Site.domain`. |

Exemplo:

```bash
curl -X POST https://api.exemplo.com/api/sites/8f.../deploy \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"commitMessage":"Ajuste na home"}'
```

## Modelo de dados

`site_deployments` (`apps/api/prisma/schema.prisma` → `SiteDeployment`):

- `status`: `UPLOADING` → `READY` | `ERROR` (reconciliado pelo job);
- `source_hash`: SHA-256 do conjunto `caminho:hash` de todos os arquivos — base da
  idempotência;
- `project_name`, `provider_deployment_id`, `url`, `file_count`, `total_bytes`, `error`.

`site_domains` (`SiteDomain`): `hostname` único, `zone_id`, `provider_status`,
`validation` (JSON da Cloudflare), `dns_record` (o que foi criado/esperado),
`last_checked_at`.

O site continua usando `sites.domain` / `sites.domain_status` como leitura rápida
(`NONE`, `PENDING_DNS`, `ACTIVE`, `ERROR`).

Migração: `apps/api/prisma/migrations/20261118130000_site_deploy_cloudflare/migration.sql`.
Aplicar com `pnpm --filter @vexorasuite/api db:migrate` (ou `prisma migrate deploy`).

## Idempotência e concorrência

- Antes de chamar a Cloudflare, o deploy calcula o `sourceHash` do site renderizado.
  Se já existe um `SiteDeployment` `READY` com o mesmo `siteId` + `projectName` +
  `sourceHash`, a API responde `reused: true` sem publicar de novo (`force: true` ignora).
- O upload usa `check-missing`: arquivos já existentes na conta não são enviados outra vez.
- O job de reconciliação (`site-deploy-reconcile`, a cada 60 s) usa `JobLeaseService`:
  só uma réplica consulta a Cloudflare; publicações `UPLOADING` e domínios pendentes são
  atualizados no banco. Falha de rede não derruba o processo.

## Renderização

`site-renderer.ts` transforma as páginas/blocos persistidos em arquivos:

- `index.html` (página `HOME` ou slug `inicio`), `<slug>/index.html` para as demais;
- `noticias/<slug>/` e `imoveis/<slug>/` para itens publicados, além das listagens;
- `assets/site.css` e assets referenciados por `/api/backend/public/site-assets/<id>`
  (copiados como `/assets/<id>.<ext>`);
- `404.html`;
- `externalHtml`/`freeLayout` com documento completo viram a página inteira.

Texto é escapado; apenas o HTML do próprio tenant (`externalHtml`/`freeLayout`) é
reproduzido. O orçamento local é 5.000 arquivos / 80 MB (o limite do Pages é 20.000
arquivos / 25 MiB por arquivo).

## Segurança

- Token nunca aparece em resposta, log ou audit (só `accountId` e a origem).
- Credencial por empresa tem precedência; falha de decifra **não** cai para o token do
  servidor (evita publicar na conta errada).
- `accountId` é validado no formato (32 hex) e o token em `/user/tokens/verify`.
- Token recomendado (Cloudflare → My Profile → API Tokens):
  `Account → Cloudflare Pages: Edit` + `Zone → DNS: Edit` + `Zone → Zone: Read`,
  limitado à conta/zona do cliente.
- Toda ação relevante grava `AuditLog` (`site.deploy`, `site.domain.attach`,
  `site.domain.active`, `site.domain.remove`, `site.cloudflare.*`).

## Variáveis de ambiente

```dotenv
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
SITE_PAGES_PROJECT_PREFIX=vexora-site
INTEGRATION_ENCRYPTION_KEY=   # já usado pelas credenciais BYO; obrigatório em produção
```

## Limitações conhecidas

- O produto Sites não está no menu atual; não há wizard de domínio na UI. A publicação é
  feita por estes endpoints (o front pode consumi-los quando o produto voltar).
- Apex em zona **fora** da Cloudflare exige CNAME/ALIAS no provedor de DNS; não há
  como criar esse registro por API.
- CAA restritivo no domínio pode impedir o SSL; o status `blocked`/`error` é propagado.
- Não há rollback automático: republicar uma versão anterior é um novo deploy com o
  conteúdo correspondente (o histórico guarda `sourceHash`, não os bytes).

## Testes

```bash
pnpm --filter @vexorasuite/api test -- sites-deploy
pnpm --filter @vexorasuite/api typecheck
```

Os testes usam `fetch` falso: nenhuma chamada real à Cloudflare é feita.
