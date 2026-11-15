-- Pastas do gerenciador de arquivos dos sites.
CREATE TABLE "site_folders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "path" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_folders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "site_folders_tenant_path_key" ON "site_folders"("tenant_id", "path");
CREATE INDEX "site_folders_tenant_path_idx" ON "site_folders"("tenant_id", "path");
ALTER TABLE "site_folders" ADD CONSTRAINT "site_folders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_assets" ADD COLUMN "folder" TEXT NOT NULL DEFAULT '/';
CREATE INDEX "site_assets_tenant_folder_idx" ON "site_assets"("tenant_id", "folder");
