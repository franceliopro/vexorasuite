-- Publicação de sites em domínio próprio via Cloudflare Pages (Direct Upload).
-- O token da Cloudflare é BYO por empresa (integrations.cloudflare, criptografado).

CREATE TABLE "site_deployments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "site_id" UUID NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL DEFAULT 'CLOUDFLARE_PAGES',
  "project_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UPLOADING',
  "source_hash" TEXT NOT NULL,
  "branch" TEXT NOT NULL DEFAULT 'main',
  "provider_deployment_id" TEXT,
  "url" TEXT,
  "page_count" INTEGER NOT NULL DEFAULT 0,
  "file_count" INTEGER NOT NULL DEFAULT 0,
  "total_bytes" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "finished_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "site_deployments_tenant_site_created_idx" ON "site_deployments" ("tenant_id", "site_id", "created_at");
CREATE INDEX "site_deployments_status_updated_idx" ON "site_deployments" ("status", "updated_at");

CREATE TABLE "site_domains" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "site_id" UUID NOT NULL UNIQUE REFERENCES "sites"("id") ON DELETE CASCADE,
  "hostname" TEXT NOT NULL UNIQUE,
  "zone_id" TEXT,
  "provider_status" TEXT NOT NULL DEFAULT 'PENDING',
  "validation" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "dns_record" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "last_checked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "site_domains_tenant_idx" ON "site_domains" ("tenant_id");
CREATE INDEX "site_domains_status_checked_idx" ON "site_domains" ("provider_status", "last_checked_at");
