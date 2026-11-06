ALTER TABLE "work_tasks" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'COMPANY';

UPDATE "work_tasks" SET "scope" = 'CONTACT_PROCEDURE' WHERE "contact_id" IS NOT NULL;

DROP INDEX IF EXISTS "work_tasks_tenant_id_status_due_at_idx";
CREATE INDEX "work_tasks_tenant_id_scope_status_due_at_idx" ON "work_tasks"("tenant_id", "scope", "status", "due_at");

