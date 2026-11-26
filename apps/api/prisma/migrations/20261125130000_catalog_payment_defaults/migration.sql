-- Itens cadastrados sem categoria ficavam fora da vitrine do Financeiro e de Nova assinatura.
-- Itens com categoria explícita (ex.: Consultoria, Web) permanecem como estão.
ALTER TABLE "catalog_items" ALTER COLUMN "category" SET DEFAULT 'ASAAS';

UPDATE "catalog_items"
SET "category" = 'ASAAS'
WHERE "category" IS NULL OR btrim("category") = '';
