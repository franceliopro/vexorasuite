CREATE TABLE "catalog_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL DEFAULT 'PRODUCT',
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "sku" TEXT,
  "price_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "unit" TEXT NOT NULL DEFAULT 'un',
  "image_url" TEXT,
  "category" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "catalog_items_tenant_kind_active_idx" ON "catalog_items" ("tenant_id", "active", "kind");
