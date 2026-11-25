-- Remove apenas os dados dos módulos Marketing e Sites internos, que nunca
-- chegaram a funcionar. Nenhuma tabela é removida nesta etapa: os serviços
-- legados continuam compilando e a mudança é reversível por backup.
--
-- PRESERVADO de propósito:
--   creative_references        -> usada por automação, agentes e briefings
--   site_hub_*                 -> sites externos publicados via GitHub/Cloudflare
--   site_hub_submission_decisions -> auditoria do formulário público
--   Directus e credenciais Google -> usados por canais, e-mail, calendário e perfil

-- Filhos primeiro, pais por último.
DELETE FROM "SiteVersion";
DELETE FROM "SiteDeployment";
DELETE FROM "SiteDomain";
DELETE FROM "SiteDocument";

DELETE FROM "site_form_submissions";
DELETE FROM "site_forms";
DELETE FROM "site_blocks";
DELETE FROM "site_pages";
DELETE FROM "property_applications";
DELETE FROM "site_items";
DELETE FROM "property_scopes";
DELETE FROM "site_folders";
DELETE FROM "site_assets";

DELETE FROM "creative_brief_events";
DELETE FROM "creative_briefs";

DELETE FROM "sites";
