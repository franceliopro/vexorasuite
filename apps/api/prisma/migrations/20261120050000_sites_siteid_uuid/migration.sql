-- Alinha os `siteId` dos modelos do remodel com `sites.id` (UUID).
--
-- A migração 20261119090000_sites_remodel_tables criou "SiteDomain",
-- "SiteDeployment" e "SiteDocument" com `siteId` TEXT e sem FK, porque
-- `sites.id` é UUID. O Prisma então gera joins comparando UUID com TEXT e
-- `prisma.site.findMany()` falha com Postgres 42883:
--   operator does not exist: uuid = text
--
-- As três tabelas ainda não possuem registros, portanto o cast é seguro.

ALTER TABLE "SiteDomain"    ALTER COLUMN "siteId" TYPE UUID USING "siteId"::UUID;
ALTER TABLE "SiteDeployment" ALTER COLUMN "siteId" TYPE UUID USING "siteId"::UUID;
ALTER TABLE "SiteDocument"   ALTER COLUMN "siteId" TYPE UUID USING "siteId"::UUID;

ALTER TABLE "SiteDomain" DROP CONSTRAINT IF EXISTS "SiteDomain_siteId_fkey";
ALTER TABLE "SiteDeployment" DROP CONSTRAINT IF EXISTS "SiteDeployment_siteId_fkey";
ALTER TABLE "SiteDocument" DROP CONSTRAINT IF EXISTS "SiteDocument_siteId_fkey";

ALTER TABLE "SiteDomain"
  ADD CONSTRAINT "SiteDomain_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteDeployment"
  ADD CONSTRAINT "SiteDeployment_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SiteDocument"
  ADD CONSTRAINT "SiteDocument_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
