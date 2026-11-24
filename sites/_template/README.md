# Template Astro para sites públicos Véxora

Padrão único para **sites públicos** (institucional, landing, imóveis, conteúdo).
O HUB Véxora e a Aba Sites continuam em **Next.js**; este template é apenas a
camada de vitrine, estática e rápida.

## O que já vem pronto

| Tela / interface | Arquivo |
|---|---|
| Home com hero, benefícios e conteúdo Markdown | `src/pages/index.astro` |
| Sobre com conteúdo em Content Collections | `src/pages/sobre.astro` |
| Contato com canais e formulário | `src/pages/contato.astro` |
| Página 404 (sem indexação) | `src/pages/404.astro` |
| `sitemap.xml` e `robots.txt` gerados no build | `src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts` |
| SEO: canonical, Open Graph, Twitter Card, JSON-LD | `src/components/Seo.astro` |
| Header responsivo, Footer, Breadcrumb, CTA | `src/components/` |
| Botão de WhatsApp e formulário com comportamento honesto | `src/components/WhatsAppButton.astro`, `ContactForm.astro` |
| Auditoria de links e assets do HTML gerado | `scripts/audit-links.mjs` |
| Scaffold de novos sites | `scripts/scaffold-site.mjs` |

Formulário: com `PUBLIC_CONTACT_ENDPOINT`, faz `POST` e só confirma sucesso em
**2xx**. Sem endpoint, abre WhatsApp ou e-mail e avisa que a confirmação do
envio acontece no aplicativo — nunca afirma envio concluído.

Valores de exemplo (`{{...}}`, domínios `.example`, telefones só com zeros) são
tratados como "a configurar" e não viram links publicados.

## Estrutura

```txt
sites/_template/
  public/            logo, favicon e imagem Open Graph
  scripts/           scaffold + auditoria
  src/
    components/      Header, Footer, Hero, Section, FeatureGrid, CtaBand,
                     ContactForm, WhatsAppButton, Breadcrumb, Seo
    content/pages/   textos em Markdown
    data/            site.config.ts (identidade) e site.types.ts
    layouts/         BaseLayout.astro
    lib/             helpers de config, sitemap e robots
    pages/           telas + endpoints estáticos
    styles/          global.css
  astro.config.mjs   output static, trailing slash, build em dist/
```

## Criando um site novo

```bash
node sites/_template/scripts/scaffold-site.mjs "Alto Araguaia Imóveis" \
  --slug alto-araguaia-imoveis \
  --url https://www.exemplo.com.br \
  --email contato@exemplo.com.br \
  --phone "(64) 3333-4444" \
  --whatsapp 5564999999999 \
  --address "Alto Araguaia - MT"
cd sites/alto-araguaia-imoveis
pnpm install
pnpm verify
```

Para personalizar hero, benefícios, navegação e redes, use `--config arquivo.json`
com as chaves `hero`, `features`, `navigation` e `social`.

## Configuração

- `src/data/site.config.ts`: nome, título, descrição, URL canônica, contatos,
  hero e navegação. É o centro da identidade do site.
- `src/content/pages/*.md`: textos das páginas, com frontmatter validado.
- `.env` (não versionado): `PUBLIC_SITE_URL` e, opcionalmente,
  `PUBLIC_CONTACT_ENDPOINT`.
- `public/logo.svg`, `public/favicon.svg`, `public/og-default.svg`:arte substitution por site.

## Verificação local

```bash
pnpm install
pnpm dev       # http://localhost:3200
pnpm verify    # astro check + astro build + auditoria
```

A auditoria exige `index.html`, `404.html`, `sitemap.xml`, `robots.txt`, todos
os links internos resolvidos e `Sitemap:` absoluto em HTTPS.

## Deploy (Cloudflare Pages via Git)

```txt
Git → GitHub Actions (check + build + audit) → dist/ → Cloudflare Pages
```

No projeto do Pages: **Root directory** = `sites/<slug>`, **Build command** =
`pnpm build`, **Build output** = `dist`. Cada site tem projeto, domínio e
variáveis próprias. Nenhuma credencial é compartilhada entre empresas.

As páginas são arquivos no Git, editáveis na Tina. No Alto Araguaia Imóveis, os
dados dinâmicos (imóveis, usuários, submissões) ficam no **Directus** no
Dokploy; um Flow grava o snapshot como arquivos
`src/content/properties/*.md` e o Astro lê a coleção no build. Os demais sites
são 100% Git-native.
Veja `docs/sites-stack-hibrido.md`, `docs/directus-imoveis-contract.md`,
`docs/cloudflare-site-deploy.md` e `docs/deployment-dokploy.md`.

O build bem-sucedido **não** é publicação. Só se reporta "no ar" após resposta
**2xx** verificada na URL final.

## Como isso ajuda a Aba Sites

A Aba Sites continua sendo o HUB de pedidos, preview, aprovação e evidência —
não um criador visual. O template é a "esteira" que o HUB coordena:

1. Pedido `tenant-scoped` é registrado (`DRAFT`) com tipo de site e domínio alvo.
2. O executor aplica o template, gera `dist/` e publica um preview HTTPS.
3. `registerPreview(previewUrl, commitSha)` registra a versão (`PREVIEW_READY`).
4. Uma pessoa aprova (`APPROVED`); a decisão fica auditada.
5. `requestPublish()` sinaliza a solicitação ao host/executor.
6. O host publica `dist/`. A API faz health-check: `PUBLISHED` **somente** com 2xx.
7. Rollback é trocar de commit e repetir o fluxo; o histórico já está no Git.

Na prática: a Aba Sites passa a ter um **modelo físico** para cada pedido, uma
prévia comparável, uma aprovação registrada e uma publicação verificada — sem
virar editor visual e sem prometer o que não foi executado.

## Regras

- Nunca copiar credenciais, contatos ou sessões entre empresas.
- Rotas e operações novas sob `/sites/...` herdam o módulo `SITES` e o `tenantId`.
- Não versionar `node_modules/`, `dist/`, `.astro/` nem `.env`.
- `pnpm-lock.yaml` de cada site é versionado junto com o site.
