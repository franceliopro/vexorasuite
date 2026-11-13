ALTER TABLE "site_assets" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "site_assets" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'image';
CREATE INDEX "site_assets_tenant_id_kind_created_at_idx" ON "site_assets"("tenant_id","kind","created_at");
