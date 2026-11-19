-- Remove as tabelas legadas do módulo Sites anterior ao remodel.
-- O módulo antigo nunca serviu nenhuma requisição em produção (o SitesDeployModule
-- nunca foi registrado no AppModule), então as tabelas estão vazias.
-- O sistema remodelado usa "SiteDomain", "SiteDeployment", "SiteDocument" e "SiteVersion".

DROP TABLE IF EXISTS "site_domains";
DROP TABLE IF EXISTS "site_deployments";
