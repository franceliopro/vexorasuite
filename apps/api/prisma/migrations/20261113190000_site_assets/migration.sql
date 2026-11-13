CREATE TABLE "site_assets" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"  UUID NOT NULL,
    "mime_type"  TEXT NOT NULL,
    "width"      INTEGER NOT NULL DEFAULT 0,
    "height"     INTEGER NOT NULL DEFAULT 0,
    "bytes"      BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "site_assets_tenant_id_created_at_idx" ON "site_assets"("tenant_id", "created_at");

ALTER TABLE "site_assets" ADD CONSTRAINT "site_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
