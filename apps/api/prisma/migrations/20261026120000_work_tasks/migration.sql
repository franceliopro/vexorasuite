CREATE TABLE "work_tasks" ("id" UUID NOT NULL,"tenant_id" UUID NOT NULL,"title" TEXT NOT NULL,"description" TEXT NOT NULL DEFAULT '',"status" TEXT NOT NULL DEFAULT 'OPEN',"priority" TEXT NOT NULL DEFAULT 'NORMAL',"complexity" INTEGER NOT NULL DEFAULT 1,"assignee_id" UUID,"created_by_id" UUID NOT NULL,"contact_id" UUID,"conversation_id" UUID,"due_at" TIMESTAMP(3),"completed_at" TIMESTAMP(3),"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL,CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("id"));
CREATE TABLE "work_task_steps" ("id" UUID NOT NULL,"task_id" UUID NOT NULL,"label" TEXT NOT NULL,"done" BOOLEAN NOT NULL DEFAULT false,"position" INTEGER NOT NULL DEFAULT 0,"checked_at" TIMESTAMP(3),"checked_by_id" UUID,CONSTRAINT "work_task_steps_pkey" PRIMARY KEY ("id"));
CREATE INDEX "work_tasks_tenant_id_status_due_at_idx" ON "work_tasks"("tenant_id","status","due_at");
CREATE INDEX "work_tasks_tenant_id_assignee_id_idx" ON "work_tasks"("tenant_id","assignee_id");
CREATE INDEX "work_task_steps_task_id_position_idx" ON "work_task_steps"("task_id","position");
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_task_steps" ADD CONSTRAINT "work_task_steps_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
