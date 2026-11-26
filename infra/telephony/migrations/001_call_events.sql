-- Serviço de telefonia isolado. Nenhum número de telefone é gravado: apenas hash
-- por tenant/canal. Sem consentimento, gravação e transcrição ficam vazias.
BEGIN;

CREATE TABLE IF NOT EXISTS call_consent (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID        NOT NULL,
    channel       TEXT        NOT NULL CHECK (channel IN ('PHONE', 'SMS')),
    party_hash    TEXT        NOT NULL CHECK (length(party_hash) = 64),
    granted_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    opted_out     BOOLEAN     NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT call_consent_tenant_channel_party_key UNIQUE (tenant_id, channel, party_hash)
);

CREATE TABLE IF NOT EXISTS call_events (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID        NOT NULL,
    provider          TEXT        NOT NULL CHECK (provider = upper(provider) AND btrim(provider) <> ''),
    external_call_id  TEXT        NOT NULL CHECK (btrim(external_call_id) <> ''),
    event_type        TEXT        NOT NULL CHECK (event_type IN (
                                      'call.started', 'call.answered', 'call.ended',
                                      'call.failed', 'recording.ready', 'transcript.ready')),
    direction         TEXT        NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    channel           TEXT        NOT NULL CHECK (channel IN ('PHONE', 'SMS')),
    party_hash        TEXT        NOT NULL CHECK (length(party_hash) = 64),
    counterparty_hash TEXT        CHECK (counterparty_hash IS NULL OR length(counterparty_hash) = 64),
    occurred_at       TIMESTAMPTZ NOT NULL,
    correlation_id    TEXT        NOT NULL CHECK (btrim(correlation_id) <> ''),
    recording_url     TEXT,
    transcript        TEXT,
    ai_allowed        BOOLEAN     NOT NULL DEFAULT false,
    consent_reason    TEXT        NOT NULL CHECK (consent_reason IN (
                                      'GRANTED', 'NO_CONSENT', 'REVOKED', 'OPTED_OUT', 'CHANNEL_MISMATCH')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT call_events_idempotency_key UNIQUE (tenant_id, provider, external_call_id, event_type),
    CONSTRAINT call_events_media_requires_consent CHECK (
        consent_reason = 'GRANTED' OR
        (recording_url IS NULL AND transcript IS NULL AND ai_allowed = false)
    )
);

CREATE INDEX IF NOT EXISTS call_events_tenant_occurred_idx ON call_events (tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS call_consent_tenant_idx ON call_consent (tenant_id);

CREATE TABLE IF NOT EXISTS telephony_audit (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID        NOT NULL,
    action         TEXT        NOT NULL,
    entity_type    TEXT        NOT NULL,
    entity_id      UUID,
    correlation_id TEXT        NOT NULL,
    details        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telephony_audit_tenant_created_idx ON telephony_audit (tenant_id, created_at);

COMMIT;
