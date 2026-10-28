-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "pipeline_id" UUID;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "routing_category" TEXT,
ADD COLUMN     "routing_platform" TEXT;

-- CreateTable
CREATE TABLE "crm_pipelines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'GENERAL',
    "stages" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "crm_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_pipelines_department_id_key" ON "crm_pipelines"("department_id");

-- CreateIndex
CREATE INDEX "crm_pipelines_tenant_id_enabled_idx" ON "crm_pipelines"("tenant_id", "enabled");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "crm_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing inbox access during the transition; new departments/users start without modules.
UPDATE departments SET modules=ARRAY['INBOX']::TEXT[];
UPDATE memberships SET modules=ARRAY['INBOX']::TEXT[] WHERE role IN ('AGENT','MANAGER');
