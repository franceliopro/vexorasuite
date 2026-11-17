ALTER TABLE "conversations" ADD COLUMN "support_context" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "support_requests" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "destination_id" UUID NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "origin_department_id" UUID,
  "origin_assignee_id" UUID NOT NULL,
  "requested_by" UUID NOT NULL,
  "completed_by" UUID,
  "kind" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'OPEN',
  "note" TEXT NOT NULL,
  "answer" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "support_requests_kind_check" CHECK ("kind" IN ('HELP', 'ESCALATION')),
  CONSTRAINT "support_requests_state_check" CHECK ("state" IN ('OPEN', 'DONE', 'CANCELLED'))
);

CREATE INDEX "support_requests_tenant_id_state_destination_id_due_at_idx"
ON "support_requests" ("tenant_id", "state", "destination_id", "due_at");

CREATE INDEX "support_requests_conversation_id_state_idx"
ON "support_requests" ("conversation_id", "state");

CREATE UNIQUE INDEX "support_requests_open_escalation_key"
ON "support_requests" ("conversation_id") WHERE "kind" = 'ESCALATION' AND "state" = 'OPEN';

CREATE UNIQUE INDEX "support_requests_open_help_key"
ON "support_requests" ("conversation_id", "destination_id") WHERE "kind" = 'HELP' AND "state" = 'OPEN';
