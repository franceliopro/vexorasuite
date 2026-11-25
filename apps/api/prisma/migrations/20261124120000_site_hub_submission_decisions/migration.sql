-- Decisões do HUB sobre submissões do Directus: auditoria, dono da decisão e idempotência.
-- Nenhuma linha aqui afirma que a notificação ao anunciante foi entregue.

CREATE TABLE "site_hub_submission_decisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "submission_key" TEXT NOT NULL,
    "directus_id" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "actor_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_hub_submission_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_hub_submission_decisions_tenant_id_submission_key_key" ON "site_hub_submission_decisions"("tenant_id", "submission_key");
CREATE INDEX "site_hub_submission_decisions_tenant_id_created_at_idx" ON "site_hub_submission_decisions"("tenant_id", "created_at");

ALTER TABLE "site_hub_submission_decisions" ADD CONSTRAINT "site_hub_submission_decisions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
