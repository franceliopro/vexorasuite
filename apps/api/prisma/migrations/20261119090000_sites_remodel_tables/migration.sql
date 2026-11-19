-- Remodelagem solicitada do módulo Sites.
-- As tabelas "SiteDomain"/"SiteDeployment" e os modelos novos
-- "SiteDocument"/"SiteVersion" não tinham migração, então o banco de produção
-- ficaria sem elas (erro 500 nos endpoints de Sites/editor).
-- Esta migração é aditiva: cria apenas as tabelas/enums do remodel.
-- Obs.: os FKs para "sites" não foram criados porque sites.id é UUID e os
-- modelos do remodel declaram siteId TEXT; a relação segue na aplicação.
-- As tabelas legadas "site_domains"/"site_deployments" são mantidas intactas.

CREATE TYPE "SiteStatus" AS ENUM ('DRAFT', 'DEPLOYING', 'LIVE', 'FAILED');
CREATE TYPE "DeployStatus" AS ENUM ('QUEUED', 'UPLOADING', 'DEPLOYED', 'FAILED');
CREATE TYPE "DomainStatus" AS ENUM ('PENDING_DNS', 'VERIFYING', 'ACTIVE', 'FAILED');

CREATE TABLE "SiteDomain" (
  "id"            TEXT PRIMARY KEY,
  "siteId"        TEXT NOT NULL,
  "domain"        TEXT NOT NULL,
  "status"        "DomainStatus" NOT NULL DEFAULT 'PENDING_DNS',
  "cfProjectName" TEXT,
  "cfZoneId"      TEXT,
  "dnsRecordId"   TEXT,
  "sslStatus"     TEXT,
  "verifiedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "SiteDomain_domain_key" ON "SiteDomain"("domain");
CREATE INDEX "SiteDomain_siteId_idx" ON "SiteDomain"("siteId");

CREATE TABLE "SiteDeployment" (
  "id"              TEXT PRIMARY KEY,
  "siteId"          TEXT NOT NULL,
  "domainId"        TEXT,
  "status"          "DeployStatus" NOT NULL DEFAULT 'QUEUED',
  "cfDeploymentId"  TEXT,
  "cfDeploymentUrl" TEXT,
  "contentHash"     TEXT,
  "errorMessage"    TEXT,
  "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SiteDeployment_siteId_idx" ON "SiteDeployment"("siteId");
CREATE INDEX "SiteDeployment_contentHash_idx" ON "SiteDeployment"("contentHash");

CREATE TABLE "SiteDocument" (
  "id"        TEXT PRIMARY KEY,
  "siteId"    TEXT NOT NULL,
  "document"  JSONB NOT NULL,
  "version"   INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "SiteDocument_siteId_key" ON "SiteDocument"("siteId");
CREATE INDEX "SiteDocument_siteId_idx" ON "SiteDocument"("siteId");

CREATE TABLE "SiteVersion" (
  "id"             TEXT PRIMARY KEY,
  "siteDocumentId" TEXT NOT NULL REFERENCES "SiteDocument"("id") ON DELETE CASCADE,
  "version"        INTEGER NOT NULL,
  "document"       JSONB NOT NULL,
  "createdBy"      TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "SiteVersion_siteDocumentId_version_key" ON "SiteVersion"("siteDocumentId", "version");
CREATE INDEX "SiteVersion_siteDocumentId_idx" ON "SiteVersion"("siteDocumentId");
