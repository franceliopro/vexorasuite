-- Campos públicos aprovados da vitrine: separados da descrição/imagem privadas da Véxora.
ALTER TABLE "catalog_items"
  ADD COLUMN "public_description" TEXT,
  ADD COLUMN "public_image_url" TEXT,
  ADD COLUMN "public_link" TEXT;

-- URL HTTPS configurada da vitrine; links compartilhados são derivados dela.
ALTER TABLE "storefront_tokens"
  ADD COLUMN "site_url" TEXT;
