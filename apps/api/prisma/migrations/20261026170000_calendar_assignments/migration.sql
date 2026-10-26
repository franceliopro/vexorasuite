CREATE TABLE "calendar_assignments" ("id" UUID NOT NULL,"tenant_id" UUID NOT NULL,"account_id" UUID NOT NULL,"calendar_id" TEXT NOT NULL,"user_id" UUID,"department_id" UUID,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "calendar_assignments_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "calendar_assignments_tenant_id_account_id_calendar_id_user_id_department_id_key" ON "calendar_assignments"("tenant_id","account_id","calendar_id","user_id","department_id");
CREATE INDEX "calendar_assignments_tenant_id_user_id_idx" ON "calendar_assignments"("tenant_id","user_id");
CREATE INDEX "calendar_assignments_tenant_id_department_id_idx" ON "calendar_assignments"("tenant_id","department_id");
ALTER TABLE "calendar_assignments" ADD CONSTRAINT "calendar_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
