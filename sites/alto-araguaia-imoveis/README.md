# Alto Araguaia Imóveis

Site público em **Astro estático**, criado a partir de `sites/_template`.

## O que está implementado

| Tela | Rota | Arquivo |
|---|---|---|
| Home com hero, imóveis em destaque, benefícios, região e 3 passos | `/` | `src/pages/index.astro` |
| Listagem com busca e filtros por tipo/contato | `/imoveis/` | `src/pages/imoveis/index.astro` |
| Detalhe do imóvel com galeria, ficha, descrição e formulário | `/imoveis/<slug>/` | `src/pages/imoveis/[slug].astro` |
| Sobre | `/sobre/` | `src/pages/sobre.astro` |
| Contato com canais e formulário | `/contato/` | `src/pages/contato.astro` |
| 404 | `/404.html` | `src/pages/404.astro` |
| Sitemap e robots gerados | `/sitemap.xml`, `/robots.txt` | `src/pages/` |

Conteúdo em `src/content/pages/` e imóveis em `src/content/properties/`, ambos
com schema validado por Content Collections.

## Estado honesto deste checkout

- ✅ Código, telas, filtros, galeria, SEO, sitemap e auditoria implementados.
- ✅ Build estático validado localmente quando `pnpm verify` passa.
- ⚠️ **E-mail, telefone e WhatsApp não foram informados** — os campos estão vazios
  no `src/data/site.config.ts`. O formulário abre e-mail/WhatsApp apenas se houver
  valor real; com os campos vazios ele avisa que o canal está em configuração.
- ⚠️ **Os seis imóveis são demonstrativos** (`sample: true`). Eles mostram o
  layout completo, mas não devem ir ao ar como ofertas reais.
- ⚠️ **Domínio não informado** — a URL canônica está como
  `https://altoaraguaia-imoveis.example` apenas para o build. Substitua antes de publicar.
- ⏳ **Não há deploy executado neste checkout.** Publicação exige projeto no
  Cloudflare Pages, domínio e credenciais. Nenhum status "no ar" é afirmado sem 2xx.

## Antes de publicar

1. Preencher `name/title/description/url/email/phone/whatsapp/address` em
   `src/data/site.config.ts` com dados oficiais.
2. Substituir os arquivos de `src/content/properties/` pelos imóveis reais e
   trocar `sample: true` para `false`.
3. Substituir `public/images/*.svg` por fotos reais e ajustar `og-default.svg`.
4. Definir `PUBLIC_SITE_URL` com o domínio final.
5. Opcional: definir `PUBLIC_CONTACT_ENDPOINT` (HTTPS) para receber o formulário
   via POST; sem isso o formulário abre WhatsApp/e-mail e não afirma envio.
6. Rodar `pnpm verify`.

## Desenvolvimento

```bash
cd sites/alto-araguaia-imoveis
pnpm install
pnpm dev       # http://localhost:3200
pnpm verify    # astro check + astro build + auditoria de links
```

## Deploy

Cloudflare Pages: **Root directory** `sites/alto-araguaia-imoveis`,
**Build command** `pnpm build`, **Build output** `dist`.
Workflow: `.github/workflows/site-alto-araguaia-imoveis.yml`.

## Aba Sites

O mesmo fluxo do template: pedido tenant-scoped → build/preview com `commitSha` →
aprovação humana → publicação pelo host → `PUBLISHED` somente após health-check 2xx.
