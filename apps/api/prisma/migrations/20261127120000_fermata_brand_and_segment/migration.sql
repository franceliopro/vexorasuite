-- A empresa criada como "Escola de Música" passa a ser Fermata Music.
-- Nenhuma credencial, contato, fatura ou sessão é copiada; somente o tenant
-- explicitamente criado com o segmento music-school é alterado.
WITH full_baseline AS (
  SELECT jsonb_build_object(
    'modules', to_jsonb(ARRAY['INBOX','CRM','AUTOMATION','CHANNELS','CALENDAR','TASKS','FINANCE','MARKETING','SITES','SETTINGS']::text[]),
    'attendants', 999,
    'bots', 99,
    'iaLimit', 999999,
    'iaTier', 'standard',
    'sites', 0,
    'socialAccounts', 999,
    'marketingPublishing', true,
    'followups', true,
    'finance', true,
    'crm', true,
    'dynamicSites', true,
    'forms', true,
    'paymentProvider', 'ASAAS'
  ) AS value
)
UPDATE "tenants" AS t
SET
  "name" = CASE WHEN t."name" = 'Escola de Música' THEN 'Fermata Music' ELSE t."name" END,
  "integrations" = COALESCE(t."integrations", '{}'::jsonb) || jsonb_build_object(
    'brandSettings', COALESCE(t."integrations"->'brandSettings', '{}'::jsonb) || jsonb_build_object(
      'primaryColor', '#000000',
      'sidebarBackground', '#000000',
      'sidebarForeground', '#FFFFFF',
      'sidebarHover', '#1A1A1A'
    ),
    'segment', COALESCE(t."integrations"->'segment', '{}'::jsonb) || jsonb_build_object(
      'id', 'music-school',
      'name', 'Escola de Música e Instrumentos',
      'vocabulary', jsonb_build_object(
        'aluno', 'aluno',
        'responsavel', 'responsável',
        'turma', 'turma',
        'matricula', 'matrícula',
        'presenca', 'presença',
        'instrumento', 'instrumento',
        'professor', 'professor',
        'aula', 'aula'
      )
    )
  ),
  "entitlements" = CASE
    WHEN jsonb_typeof(t."entitlements"->'modules') = 'array'
      THEN jsonb_set(
        (SELECT value FROM full_baseline) || COALESCE(t."entitlements", '{}'::jsonb),
        '{modules}',
        (
          SELECT to_jsonb(array_agg(DISTINCT module))
          FROM (
            SELECT module FROM jsonb_array_elements_text(t."entitlements"->'modules') AS module
            UNION ALL SELECT 'SCHOOL'
          ) AS modules_to_grant
        )
      )
    ELSE (SELECT value FROM full_baseline) || COALESCE(t."entitlements", '{}'::jsonb)
      || jsonb_build_object('modules', (SELECT value->'modules' FROM full_baseline))
  END
WHERE COALESCE(t."integrations"->'onboarding'->>'segmentId', '') = 'music-school';
