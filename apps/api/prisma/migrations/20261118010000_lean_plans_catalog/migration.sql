-- Catálogo enxuto: 3 planos comerciais + Parceiro. O restante sai do catálogo público
-- (is_public=false); empresas já vinculadas preservam seus planos.
INSERT INTO plans (id, code, kind, name, tagline, description, audience, price_cents, currency, cycle, limits, is_active, is_public, sort_order, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'essencial', 'PLAN', 'Essencial', 'Central de atendimento + CRM',
   'Inbox compartilhado, CRM com funil, agenda, tarefas e IA de apoio.',
   'PMEs de 1 a 6 atendentes', 24900, 'BRL', 'MONTH',
   '{"modules":["INBOX","CRM","CALENDAR","TASKS"],"attendants":6,"bots":1,"iaLimit":300,"iaTier":"eco","sites":0,"socialAccounts":0,"marketingPublishing":false,"followups":true,"finance":false,"crm":true,"dynamicSites":false,"forms":false}'::jsonb,
   true, true, 10, now(), now()),
  (gen_random_uuid(), 'crescimento', 'PLAN', 'Crescimento', 'Operação completa de vendas e atendimento',
   'Tudo do Essencial + Financeiro Asaas, cobrança na conversa, 2 robôs de IA, site com IA e relatórios.',
   'PMEs em crescimento com equipe comercial', 44900, 'BRL', 'MONTH',
   '{"modules":["INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE","MARKETING","SETTINGS"],"attendants":12,"bots":2,"iaLimit":1000,"iaTier":"eco","sites":1,"socialAccounts":2,"marketingPublishing":false,"followups":true,"finance":true,"crm":true,"dynamicSites":true,"forms":true}'::jsonb,
   true, true, 20, now(), now()),
  (gen_random_uuid(), 'completa', 'PLAN', 'Completa', 'Operação exigente, tudo liberado',
   'Todos os módulos, 4 robôs de IA, relatórios de diretoria, marketing e múltiplos sites.',
   'Operações maduras em crescimento', 79900, 'BRL', 'MONTH',
   '{"modules":["INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE","MARKETING","SETTINGS"],"attendants":30,"bots":4,"iaLimit":999999,"iaTier":"standard","sites":4,"socialAccounts":6,"marketingPublishing":true,"followups":true,"finance":true,"crm":true,"dynamicSites":true,"forms":true}'::jsonb,
   true, true, 30, now(), now()),
  (gen_random_uuid(), 'parceiro', 'PLAN', 'Parceiro', 'Para quem revende para empresas',
   'Plano completo com limites ampliados e revenda com margem para parceiros Véxora.',
   'Agências e parceiros certificados', 149900, 'BRL', 'MONTH',
   '{"modules":["INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE","MARKETING","SETTINGS"],"attendants":999,"bots":99,"iaLimit":999999,"iaTier":"standard","sites":10,"socialAccounts":10,"marketingPublishing":true,"followups":true,"finance":true,"crm":true,"dynamicSites":true,"forms":true}'::jsonb,
   true, true, 40, now(), now())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  audience = EXCLUDED.audience,
  price_cents = EXCLUDED.price_cents,
  limits = EXCLUDED.limits,
  is_active = true,
  is_public = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Consolidação: só os 4 planos enxutos ficam públicos; demais arquivados do catálogo.
UPDATE plans SET is_public = false WHERE code NOT IN ('essencial', 'crescimento', 'completa', 'parceiro');
