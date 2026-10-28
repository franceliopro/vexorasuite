BEGIN;
-- Owner-authorized retirement of campaigns, automatic publishing and generated marketing history.
-- Core contacts, messages, payments, brand settings, Drive references and scheduling remain untouched.
DROP TABLE mail_deliveries;
DROP TABLE mail_campaigns;
DROP TABLE mail_items;
DROP TABLE mail_templates;
DROP TABLE mail_accounts;
DROP TABLE prepared_publications;
DROP TABLE publication_folders;
DROP TABLE marketing_jobs;
DROP TABLE marketing_workflows;
DELETE FROM audit_logs WHERE action IN ('assistant.carousel','assistant.research');
UPDATE tenants SET integrations = jsonb_set(integrations, '{marketing}', (integrations->'marketing') - 'autoPublish')
WHERE jsonb_typeof(integrations->'marketing') = 'object';

COMMIT;
