-- HUB de Sites: registro de pedido, preview, aprovação, versão, histórico e auditoria.
-- O HUB não renderiza HTML, não hospeda página e não copia credenciais entre empresas.

CREATE TYPE "SiteHubStatus" AS ENUM ('DRAFT', 'PREVIEW_READY', 'APPROVED', 'REJECTED', 'PUBLISH_REQUESTED', 'PUBLISHED', 'FAILED');

CREATE TABLE "site_hub_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'STATIC',
    "status" "SiteHubStatus" NOT NULL DEFAULT 'DRAFT',
    "brief" JSONB NOT NULL DEFAULT '{}',
    "repository" TEXT,
    "target_domain" TEXT,
    "preview_url" TEXT,
    "preview_sha" TEXT,
    "created_by" UUID NOT NULL,
    "decided_by" UUID,
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_hub_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_hub_versions" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "commit_sha" TEXT,
    "preview_url" TEXT,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_hub_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_hub_approvals" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "decided_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_hub_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_hub_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_hub_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_hub_requests_tenant_id_slug_key" ON "site_hub_requests"("tenant_id", "slug");
CREATE INDEX "site_hub_requests_tenant_id_status_idx" ON "site_hub_requests"("tenant_id", "status");
CREATE UNIQUE INDEX "site_hub_versions_request_id_version_key" ON "site_hub_versions"("request_id", "version");
CREATE INDEX "site_hub_approvals_request_id_created_at_idx" ON "site_hub_approvals"("request_id", "created_at");
CREATE INDEX "site_hub_events_request_id_created_at_idx" ON "site_hub_events"("request_id", "created_at");
CREATE INDEX "site_hub_events_tenant_id_created_at_idx" ON "site_hub_events"("tenant_id", "created_at");

ALTER TABLE "site_hub_requests" ADD CONSTRAINT "site_hub_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_hub_versions" ADD CONSTRAINT "site_hub_versions_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "site_hub_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_hub_approvals" ADD CONSTRAINT "site_hub_approvals_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "site_hub_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_hub_events" ADD CONSTRAINT "site_hub_events_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "site_hub_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
