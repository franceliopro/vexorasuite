# Piloto Rastreabem — site em Next.js/MDX

Este documento registra o primeiro site convertido para o novo serviço de sites da Véxora.

## Estado

- [x] Conversão das 7 páginas do HTML original para `content/pages/*.mdx`.
- [x] Esqueleto em componentes: `app/layout.tsx`, `app/[slug]/page.tsx`, `components/`.
- [x] Menu gerado por `content/navigation.ts`.
- [x] Assets do site original em `public/` (imagens, fonte Montserrat e dois vídeos).
- [x] Comportamentos preservados: carrossel, galeria de veículos, menu mobile e demonstrações em vídeo.
- [x] Build estático com `output: 'export'` e `trailingSlash: true` (9 páginas geradas em 2026-11-23).
- [x] Auditoria de links/assets locais: 10 arquivos HTML, 171 referências verificadas, zero quebrados — executada por `scripts/audit-links.cjs` e pelo workflow `site-rastreabem.yml`.
- [ ] Publicação em Cloudflare Pages e verificação do domínio final — depende de evidência no ar.

## O que não foi alterado

- Conteúdo textual, telefones, links de WhatsApp, links de apps e links de compra do HTML original.
- A validação dos links de compra e do painel do cliente depende de acesso externo; nenhum funcionamento é afirmado aqui.

## Como validar

```bash
cd sites/rastreabem
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
node scripts/audit-links.cjs out
pnpm start        # http://localhost:3105
```

O GitHub Actions valida o piloto no workflow `site-rastreabem.yml`: typecheck, build, presença das páginas e auditoria de links/assets locais. A auditoria resolve caminhos absolutos (`/images/...`) a partir da raiz exportada e falha se alguma referência local não existir.

## Limites

O HUB da Véxora não gera HTML nem hospeda página. Este repositório contém o código do site; publicação, DNS e TLS são operações separadas e só são consideradas concluídas com evidência no ar.
