CREATE TABLE "property_applications" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"       UUID NOT NULL,
  "site_id"         UUID NOT NULL,
  "name"            TEXT NOT NULL,
  "email"           TEXT NOT NULL,
  "phone"           VARCHAR(30) NOT NULL,
  "city"            VARCHAR(80) NOT NULL DEFAULT '',
  "pretension"      VARCHAR(40) NOT NULL DEFAULT '',
  "category"        VARCHAR(20) NOT NULL DEFAULT '',
  "property_type"   VARCHAR(60) NOT NULL DEFAULT '',
  "region"          VARCHAR(80) NOT NULL DEFAULT '',
  "neighborhood"    VARCHAR(80) NOT NULL DEFAULT '',
  "bedrooms"        INTEGER NOT NULL DEFAULT 0,
  "bathrooms"       INTEGER NOT NULL DEFAULT 0,
  "parking_spaces"  INTEGER NOT NULL DEFAULT 0,
  "area_m2"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "price"           TEXT NOT NULL DEFAULT '',
  "description"     TEXT NOT NULL DEFAULT '',
  "honeypot"        TEXT NOT NULL DEFAULT '',
  "form_loaded_at"  BIGINT NOT NULL DEFAULT 0,
  "status"          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "reason"          TEXT NOT NULL DEFAULT '',
  "reviewed_by_id"  UUID,
  "reviewed_at"     TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "property_applications_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE
);
CREATE INDEX "property_applications_tenant_site_status_idx" ON "property_applications"("tenant_id","site_id","status");
CREATE INDEX "property_applications_site_created_idx" ON "property_applications"("site_id","created_at");

CREATE TABLE "property_scopes" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"       UUID NOT NULL,
  "membership_id"   UUID NOT NULL,
  "category"        VARCHAR(20) NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_scopes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "property_scopes_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "property_scopes_membership_category_key" ON "property_scopes"("membership_id","category");
CREATE INDEX "property_scopes_tenant_idx" ON "property_scopes"("tenant_id");
