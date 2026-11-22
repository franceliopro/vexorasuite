-- Catálogo final: três planos públicos (Essencial, Crescimento e Completa) e uma
-- opção Personalizada, contratada com a Véxora. Empresas já vinculadas a planos
-- arquivados preservam entitlements e snapshots; apenas o catálogo público muda.
UPDATE plans
SET is_public = false
WHERE code NOT IN ('essencial', 'crescimento', 'completa', 'personalizado');

INSERT INTO plans (id, code, kind, name, tagline, description, audience, price_cents, currency, cycle, limits, is_active, is_public, sort_order, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'personalizado', 'PACKAGE', 'Personalizado', 'Escopo e preço definidos com a Véxora',
   'Módulos, limites e condições ajustados à operação da sua empresa.',
   'Operações com necessidades específicas', 0, 'BRL', 'ONCE',
   '{"modules":[],"attendants":0,"bots":0,"iaLimit":0,"iaTier":"eco","sites":0,"socialAccounts":0,"marketingPublishing":false,"followups":false,"finance":false,"crm":false,"dynamicSites":false,"forms":false}'::jsonb,
   true, true, 40, now(), now())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  audience = EXCLUDED.audience,
  kind = EXCLUDED.kind,
  price_cents = EXCLUDED.price_cents,
  cycle = EXCLUDED.cycle,
  limits = EXCLUDED.limits,
  is_active = true,
  is_public = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
