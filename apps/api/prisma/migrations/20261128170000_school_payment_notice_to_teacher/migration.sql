ALTER TABLE "school_billing_policies"
  ADD COLUMN IF NOT EXISTS "payment_notice_to_teacher" BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN "school_billing_policies"."payment_notice_to_teacher" IS
  'Configuração determinística: avisar o professor quando um pagamento for baixado; nenhum envio é executado por esta migração.';