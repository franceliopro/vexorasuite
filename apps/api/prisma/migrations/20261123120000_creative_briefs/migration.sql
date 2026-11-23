-- Intake estruturado de briefing criativo. Apenas registro e auditoria:
-- nenhuma peça é gerada, aprovada, publicada ou entregue por esta tabela.

CREATE TABLE "creative_briefs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "channel_format" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "approved_source" TEXT NOT NULL,
    "deadline" DATE NOT NULL,
    "approver" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_briefs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "creative_brief_events" (
    "id" UUID NOT NULL,
    "brief_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_brief_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "creative_briefs_tenant_id_created_at_idx" ON "creative_briefs"("tenant_id", "created_at");
CREATE INDEX "creative_brief_events_brief_id_created_at_idx" ON "creative_brief_events"("brief_id", "created_at");
CREATE INDEX "creative_brief_events_tenant_id_created_at_idx" ON "creative_brief_events"("tenant_id", "created_at");

ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_brief_events" ADD CONSTRAINT "creative_brief_events_brief_id_fkey"
  FOREIGN KEY ("brief_id") REFERENCES "creative_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
