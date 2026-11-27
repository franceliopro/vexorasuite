-- Espelhos técnicos por plataforma: o catálogo canônico permanece em catalog_items.
CREATE TABLE "catalog_publications" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "catalog_item_id" UUID NOT NULL,
  "provider" VARCHAR(24) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'NOT_PUBLISHED',
  "source" VARCHAR(24) NOT NULL DEFAULT 'VEXORA_TO_PROVIDER',
  "object_type" VARCHAR(24) NOT NULL DEFAULT 'PAYMENT_LINK',
  "external_id" VARCHAR(200),
  "external_url" TEXT,
  "environment" VARCHAR(24),
  "last_error" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "published_at" TIMESTAMP(3),
  "imported_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_publications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_publications_tenant_id_catalog_item_id_provider_key"
  ON "catalog_publications"("tenant_id", "catalog_item_id", "provider");
CREATE INDEX "catalog_publications_tenant_id_provider_status_idx"
  ON "catalog_publications"("tenant_id", "provider", "status");

ALTER TABLE "catalog_publications"
  ADD CONSTRAINT "catalog_publications_catalog_item_id_fkey"
  FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "catalog_publications_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
