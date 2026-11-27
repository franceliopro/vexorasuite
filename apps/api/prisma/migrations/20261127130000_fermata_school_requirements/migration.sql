-- Requisitos Fermata Music: presença pareada, resumo por aula, dias contabilizados,
-- lembretes configurados (sem envio), aprovação de cancelamento e multa contratual.
-- Nenhuma cobrança, mensagem, notificação ou pagamento é executado por esta migração.

ALTER TABLE "school_enrollments"
    ADD COLUMN "contract_total_cents" INTEGER,
    ADD COLUMN "overdue_installments" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "cancellation_status" TEXT NOT NULL DEFAULT 'NONE',
    ADD COLUMN "penalty_cents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "school_enrollments"
    ADD CONSTRAINT "school_enrollments_contract_total_check"
        CHECK ("contract_total_cents" IS NULL OR "contract_total_cents" >= 0),
    ADD CONSTRAINT "school_enrollments_overdue_check"
        CHECK ("overdue_installments" BETWEEN 0 AND 100),
    ADD CONSTRAINT "school_enrollments_cancellation_status_check"
        CHECK ("cancellation_status" IN ('NONE','SUGGESTED','APPROVED','REJECTED')),
    ADD CONSTRAINT "school_enrollments_penalty_check" CHECK ("penalty_cents" >= 0);

ALTER TABLE "school_sessions"
    ADD COLUMN "summary_html" TEXT,
    ADD COLUMN "summary_recorded_at" TIMESTAMPTZ;

CREATE TABLE "school_billing_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "payment_reminder_days_before" INTEGER NOT NULL DEFAULT 5,
    "remind_on_due_date" BOOLEAN NOT NULL DEFAULT true,
    "remind_daily_when_overdue" BOOLEAN NOT NULL DEFAULT true,
    "channels" JSONB NOT NULL DEFAULT '["WHATSAPP","SMS","EMAIL"]'::jsonb,
    "consent_required" BOOLEAN NOT NULL DEFAULT true,
    "teacher_reminder_minutes_before" INTEGER NOT NULL DEFAULT 30,
    "cancellation_approval_required" BOOLEAN NOT NULL DEFAULT true,
    "overdue_installments_for_cancellation" INTEGER NOT NULL DEFAULT 2,
    "breach_penalty_percent" INTEGER NOT NULL DEFAULT 20,
    "payment_notice_to_manager" BOOLEAN NOT NULL DEFAULT true,
    "payment_notice_to_admins" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_billing_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_billing_policies_tenant_key" UNIQUE ("tenant_id"),
    CONSTRAINT "school_billing_policies_days_before_check" CHECK ("payment_reminder_days_before" BETWEEN 0 AND 30),
    CONSTRAINT "school_billing_policies_minutes_check" CHECK ("teacher_reminder_minutes_before" BETWEEN 5 AND 120),
    CONSTRAINT "school_billing_policies_overdue_check" CHECK ("overdue_installments_for_cancellation" BETWEEN 1 AND 12),
    CONSTRAINT "school_billing_policies_percent_check" CHECK ("breach_penalty_percent" BETWEEN 0 AND 100)
);
CREATE INDEX "school_billing_policies_tenant_idx" ON "school_billing_policies"("tenant_id");
COMMENT ON TABLE "school_billing_policies" IS 'Política determinística por tenant. Canais e consentimento são requisitos; nenhum disparo é feito por esta tabela.';

CREATE TABLE "school_payment_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "enrollment_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "paid_at" DATE NOT NULL,
    "period_key" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CASH',
    "external_reference" TEXT,
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_payment_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_payment_receipts_amount_check" CHECK ("amount_cents" > 0),
    CONSTRAINT "school_payment_receipts_source_check" CHECK ("source" IN ('CASH','PROVIDER_CONFIRMED')),
    CONSTRAINT "school_payment_receipts_period_key_check" CHECK (length("period_key") BETWEEN 6 AND 12)
);
CREATE INDEX "school_payment_receipts_tenant_enrollment_idx" ON "school_payment_receipts"("tenant_id", "enrollment_id");
CREATE INDEX "school_payment_receipts_tenant_period_idx" ON "school_payment_receipts"("tenant_id", "period_key");
COMMENT ON COLUMN "school_payment_receipts"."source" IS 'CASH é baixa informada por humano; PROVIDER_CONFIRMED exige referência e confirmação real do provedor.';
