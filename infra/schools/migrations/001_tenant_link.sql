-- Contrato de vínculo entre a Véxora e o sistema escolar externo.
-- Apenas a associação tenant-scoped existe neste slice: não há cadastros acadêmicos.
-- Nenhum segredo de acesso é gravado aqui; ele fica no cofre do Dokploy.
BEGIN;

CREATE TABLE IF NOT EXISTS tenant_links (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID        NOT NULL,
    provider             TEXT        NOT NULL CHECK (provider = upper(provider) AND btrim(provider) <> ''),
    external_customer_id TEXT        NOT NULL CHECK (btrim(external_customer_id) <> ''),
    status               TEXT        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    metadata             JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_links_tenant_provider_customer_key UNIQUE (tenant_id, provider, external_customer_id)
);

CREATE INDEX IF NOT EXISTS tenant_links_tenant_id_idx ON tenant_links (tenant_id);

COMMENT ON COLUMN tenant_links.tenant_id IS 'Tenant autenticado na Véxora; nunca vem do sistema externo.';
COMMENT ON COLUMN tenant_links.provider IS 'Sistema escolar de origem, normalizado em maiúsculas.';
COMMENT ON COLUMN tenant_links.external_customer_id IS 'Identificador do cliente nesse sistema escolar.';

COMMIT;
