# Deploy de sites estáticos via Cloudflare Pages

## Modelo de hospedagem escolhido (24/11/2026)

Decisão do proprietário (atualizada em 24/11/2026): **Cloudflare Pages + Dokploy + GitHub + Directus**.

- **Sites públicos** (Astro, estáticos): um projeto Cloudflare Pages por site, com domínio e variáveis próprios.
- **Páginas e blocos**: arquivos no GitHub, editáveis na Tina (Git-native).
- **Dados dinâmicos do Alto Araguaia Imóveis** (imóveis, usuários, permissões, submissões e mídia): Directus self-hosted no Dokploy/VPS.
- **Véxora**: gerente do processo (pedido, preview, aprovação, publicação, evidência); a plataforma roda em Next.js no Dokploy.

O Cloudflare Pages **não executa PHP, MySQL nem Directus**. O build lê arquivos do repositório: as páginas vindas da Tina e o snapshot do Directus versionado como arquivos Markdown em `src/content/properties/`. Nenhuma credencial é compartilhada entre empresas. A arquitetura completa está em `docs/sites-stack-hibrido.md`.

### Sites Astro (template `sites/_template`)

Para um site novo baseado no template Astro:

| Configuração | Valor |
| --- | --- |
| Root directory | `sites/<slug>` |
| Build command | `pnpm build` |
| Build output | `dist` |
| Branch de produção | `main` |
| Domínio | próprio, por site |

Exemplo já no repositório: `sites/alto-araguaia-imoveis`.

### Saída do provedor atual

1. Reduzir o TTL dos registros DNS atuais antes da mudança.
2. Adicionar a zona do domínio na conta Cloudflare e copiar os nameservers.
3. Criar o projeto Pages, vincular o repositório e configurar o domínio customizado.
4. Validar o deployment no `*.pages.dev` com HTTP 2xx e conferir o conteúdo.
5. Trocar os nameservers no registrador e aguardar a propagação.
6. Confirmar **HTTP 2xx no domínio final** e que o conteúdo antigo não aparece.
7. Só depois cancelar o provedor antigo.

> Em 24/11/2026 nenhum deploy foi executado. A configuração abaixo registra o
> pretendido; publicação só se afirma após resposta 2xx verificada na URL final.

## Publicação via Git — abordagem atual dos sites piloto

Rastreabem e Morbeck x Carvalhinho usam **Cloudflare Pages com integração Git**.
O GitHub é a fonte única: cada push na branch de produção dispara um build no
Cloudflare. Não usar Direct Upload para esses projetos.

### Repositório e branch

- **Repository:** `franceliopro/vexorasuite`
- **Branch de produção:** `main`
- **Root directory:** `/` (deixar em branco)
- **Node version:** `20` (ou `22`)

### Projetos

| Site | Build command | Build output directory |
| --- | --- | --- |
| Rastreabem | `cd sites/rastreabem && npm install && npm run build` | `sites/rastreabem/out` |
| Morbeck x Carvalhinho | `cd sites/morbeckxcarvalhinho && npm install && npm run build` | `sites/morbeckxcarvalhinho/out` |
| Alto Araguaia Imóveis | `npm install -g pnpm@12.22.0 && pnpm install --frozen-lockfile && pnpm build` | `sites/alto-araguaia-imoveis/dist` |

Para o Alto Araguaia Imóveis, configure **Root directory** =
`sites/alto-araguaia-imoveis`, **Build output** = `dist`, **Node** = 22. Os dois
pilotos acima usam Root directory `/`. O build do Alto lê a coleção Astro de
imóveis em `src/content/properties/*.md`. Hoje esses arquivos contêm dados
migrados do site público, ainda não validados; o snapshot gerado pelo Directus
deve substituí-los antes de qualquer publicação como oferta real.

### Fluxo

1. O código estático versionado é mesclado em `main` via PR (base
   `foundation/bootstrap-monorepo`, depois sync para `main`).
2. O Cloudflare Pages detecta o push em `main` e executa o build command.
3. O conteúdo publicado é o diretório de output configurado.
4. A publicação só é considerada confirmada após **HTTP 2xx no domínio final**
   e conferência de que o conteúdo antigo não aparece.

### Evidência exigida antes de afirmar publicação

- Status do deployment no painel Cloudflare (build successful).
- `HTTP 2xx` no domínio final, não apenas em preview local ou túnel.
- Conteúdo novo conferido no domínio final.

Configuração no painel, domínio e TLS ainda dependem de execução e verificação
externas. Este documento registra a configuração pretendida, não uma publicação
já confirmada.

### Observações por site

- **Rastreabem:** Next.js/MDX com `output: "export"`; `out/` é gerado no build
  e não vai para o GitHub. CI: `.github/workflows/site-rastreabem.yml`.
- **Morbeck x Carvalhinho:** espelho estático sem WordPress em runtime. A fonte
  fica em `src/`; `out/` é gerado no build. A busca é 100% client-side:
  `src/assets/js/search.js` consome `assets/js/search-index.json`, gerado por
  `scripts/build-search-index.cjs` durante o build. CI:
  `.github/workflows/site-morbeckxcarvalhinho.yml`.

## Integração com o wizard Vexora (legado / simulação)

O fluxo abaixo descreve o código existente do wizard e **não** é o caminho usado
pelos dois sites piloto. Ele depende de credenciais reais e confirmação externa
para deixar de ser simulação.

Etapas do wizard (ver `apps/web/src/app/sites/wizard/wizard-shell.tsx`):

- Etapa "Dominio": chama `POST /sites/:id/domain` e `GET /sites/:id/domain/verify`.
- Etapa "Publicar": chama `POST /sites/:id/deploy` com os arquivos do SiteDocument renderizado.

### Abordagem antiga: Cloudflare Pages (Direct Upload)

Comparação:

- **Cloudflare Pages (Direct Upload)**: projeto Pages + upload de arquivos via
  API (multipart + manifest de hashes). Suporta domínio customizado com SSL
  automático, CDN global e preview deployments. Limite 20.000 arquivos /
  25 MiB por arquivo.
- **Workers + KV/R2**: mais flexível (rotas customizadas, lógica serverless),
  mas exige gerenciar assets no R2/KV e roteamento manual; maior complexidade e
  custo para site estático puro.

### Fluxo antigo

1. Usuário informa domínio → `POST /sites/:id/domain` { domain, tenantId }
   - Cria projeto no Cloudflare Pages (nome derivado de tenantId + slug do site).
   - Vincula domínio customizado ao projeto.
   - Se a zona do domínio estiver na conta Cloudflare do usuário, cria registro
     CNAME automaticamente; caso contrário retorna instruções para criar
     manualmente: `domínio -> <projeto>.pages.dev`.
2. Verificação DNS/SSL → `GET /sites/:id/domain/verify` { tenantId }
   - Consulta status do domínio no Pages; quando `active`, marca domínio como
     ACTIVE e grava `verifiedAt`.
3. Deploy dos arquivos → `POST /sites/:id/deploy` { tenantId, files: [{ path, contentBase64 }] }
   - Calcula hash de conteúdo para idempotência.
   - Cria deployment via Direct Upload (manifest + arquivos).
   - Persiste status (QUEUED/UPLOADING/DEPLOYED/FAILED) e URL do deployment.

### Endpoints legados

- `POST /sites/:id/domain` — body `{ domain, tenantId }`
- `GET /sites/:id/domain/verify` — body `{ tenantId }`
- `POST /sites/:id/deploy` — body `{ tenantId, files: [{ path, contentBase64 }] }`

### Modelo de dados (Prisma)

Ver `packages/database/prisma/schema.prisma`: `Site`, `SiteDomain`, `SiteDeployment`.

### Variáveis de ambiente

- `CLOUDFLARE_API_TOKEN` — token com permissão Pages Edit (e DNS Edit se for criar registros).
- `CLOUDFLARE_ACCOUNT_ID` — ID da conta Cloudflare do usuário (modo "suas").

### Credenciais

Nunca hardcoded. Lidas via `ConfigService` (NestJS) a partir de variáveis de
ambiente. Em produção, injetar via Vault/secret manager.

### Idempotência

- Domínio: upsert por `domain` (único). Re-vincular o mesmo domínio ao mesmo
  site não duplica.
- Deploy: hash SHA-256 do conteúdo; se já existe deployment DEPLOYED com o mesmo
  hash, retorna o existente (`idempotent: true`).

### Auth / tenant / permissões

Os controllers usam `tenantId` no body como placeholder. Em produção, substituir
por guards reais do Véxora (JwtAuthGuard, TenantGuard, PermissionsGuard) e ler
`tenantId` do contexto autenticado. O serviço já filtra por `tenantId` em todas
as consultas (`findFirst where tenantId`).

### Limitações / não verificado

- O fluxo de Direct Upload via API usa manifest (path -> sha256) + partes
  multipart keyed pelo hash. Cloudflare pode exigir upload em duas etapas
  (retornando URLs de upload para hashes faltantes) em alguns casos; a
  implementação atual envia todos os arquivos em uma única requisição,
  adequado para sites pequenos. Para sites grandes, implementar a etapa de
  upload por hash.
- Não foi validado contra uma conta Cloudflare real (sem credenciais); usar
  ambiente de teste/dry-run.
- Jobs assíncronos (BullMQ) não implementados; deploy é síncrono. Adicionar fila
  para sites grandes.
