# Catálogo de Serviços Véxora

Vitrine estática Astro alimentada pelo feed público `/api/public/storefront/:token`.

## Estado

O build **não afirma publicação**. Só considere o site no ar depois de evidência HTTP 2xx no domínio final. O domínio e os canais de contato em `src/data/site.config.ts` são provisórios; não substitua por dados reais sem confirmação.

## Desenvolvimento

```bash
cd sites/catalogo-servicos
pnpm install
pnpm dev
pnpm verify
```

- `pnpm dev`: servidor local em http://localhost:3200
- `pnpm run fetch`: consulta o feed e grava `src/data/catalog.json`
- `pnpm check`: checagem de tipos
- `pnpm verify`: fetch → check → build → verificação da vitrine → auditoria de links

## Variáveis de ambiente

Copie `.env.example` e configure:

- `PUBLIC_SITE_URL` / `PUBLIC_CONTACT_ENDPOINT`: site e endpoint opcional do formulário.
- `VEXORA_API_ORIGIN`: origem HTTPS da API (localhost HTTP permitido só no desenvolvimento).
- `VEXORA_CATALOG_TOKEN`: token da vitrine; **somente no ambiente de build**, nunca em `src/` ou no bundle.
- `VEXORA_CATALOG_OUTPUT`: caminho do snapshot (padrão `src/data/catalog.json`).
- `VEXORA_CATALOG_TIMEOUT_MS`: timeout da consulta (padrão `15000`).

## Status do snapshot

- `READY`: feed consultado com sucesso; itens e páginas individuais são gerados a partir dele.
- `NOT_CONFIGURED`: `VEXORA_API_ORIGIN` ou `VEXORA_CATALOG_TOKEN` ausentes; itens vazios e aviso honesto.
- `UNAVAILABLE`: falha de rede, timeout, HTTP não 2xx, feed inválido ou configuração inválida; itens vazios e aviso honesto.

Somente campos públicos entram no snapshot: `id`, `kind`, `name`, `sku`, `priceCents`, `currency`, `unit`, `category`, `publicDescription`, `publicImageUrl`, `publicLink` e `updatedAt`. Os campos internos `description` e `imageUrl` são descartados. Links públicos só são usados quando HTTPS válido. A vitrine não cria carrinho, checkout, cobrança nem confirma pedido, pagamento ou conexão com provedor.

## Antes de publicar

1. Confirme os canais oficiais em `src/data/site.config.ts` e a URL final em `PUBLIC_SITE_URL`.
2. Configure o build com as variáveis `VEXORA_*` no ambiente da hospedagem.
3. Rode `pnpm verify` e revise o aviso público nas páginas `/servicos/` e `/servicos/{id}/`.
4. No Cloudflare Pages: Root directory `sites/catalogo-servicos`, build `pnpm build`, output `dist/`.
5. Registre a publicação somente após health-check 2xx do domínio final; a aprovação é humana.
