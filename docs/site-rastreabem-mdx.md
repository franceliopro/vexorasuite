# Piloto Rastreabem — site em Next.js/MDX

Este documento registra o primeiro site convertido para o novo serviço de sites da Véxora.

## Estado

- [x] Conversão das 7 páginas do HTML original para `content/pages/*.mdx`.
- [x] Esqueleto em componentes: `app/layout.tsx`, `app/[slug]/page.tsx`, `components/`.
- [x] Menu gerado por `content/navigation.ts`.
- [x] Assets do site original em `public/` (imagens, fonte Montserrat e dois vídeos).
- [x] Comportamentos preservados: carrossel, galeria de veículos, menu mobile e demonstrações em vídeo.
- [x] Build estático com `output: 'export'` e `trailingSlash: true` (7 páginas geradas).
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
pnpm start        # http://localhost:3105
```

O GitHub Actions valida o piloto no workflow `site-rastreabem.yml`.

## Limites

O HUB da Véxora não gera HTML nem hospeda página. Este repositório contém o código do site; publicação, DNS e TLS são operações separadas e só são consideradas concluídas com evidência no ar.
