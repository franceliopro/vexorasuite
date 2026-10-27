-- AlterTable
ALTER TABLE "creative_references" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "mail_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config_encrypted" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_items" (
    "message_id" TEXT,
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_campaigns" (
    "kind" TEXT NOT NULL DEFAULT 'MARKETING',
    "in_reply_to" TEXT,
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "provider_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_workflows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "trigger" TEXT NOT NULL DEFAULT 'SCHEDULE',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "repeat_days" INTEGER NOT NULL DEFAULT 0,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "steps" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "conversation_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "position" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_accounts_tenant_id_id_key" ON "mail_accounts"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "mail_accounts_tenant_id_email_key" ON "mail_accounts"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "mail_items_tenant_id_received_at_idx" ON "mail_items"("tenant_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "mail_items_tenant_id_account_id_external_id_key" ON "mail_items"("tenant_id", "account_id", "external_id");

-- CreateIndex
CREATE INDEX "mail_templates_tenant_id_idx" ON "mail_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "mail_campaigns_tenant_id_status_idx" ON "mail_campaigns"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mail_campaigns_tenant_id_id_key" ON "mail_campaigns"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "mail_deliveries_status_updated_at_idx" ON "mail_deliveries"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "mail_deliveries_campaign_id_email_key" ON "mail_deliveries"("campaign_id", "email");

-- CreateIndex
CREATE INDEX "internal_workflows_enabled_next_run_at_idx" ON "internal_workflows"("enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "internal_workflows_tenant_id_idx" ON "internal_workflows"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "internal_workflows_tenant_id_id_key" ON "internal_workflows"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "workflow_runs_status_next_run_at_idx" ON "workflow_runs"("status", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_workflow_id_event_key_key" ON "workflow_runs"("workflow_id", "event_key");

-- AddForeignKey
ALTER TABLE "mail_accounts" ADD CONSTRAINT "mail_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_items" ADD CONSTRAINT "mail_items_tenant_id_account_id_fkey" FOREIGN KEY ("tenant_id", "account_id") REFERENCES "mail_accounts"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_templates" ADD CONSTRAINT "mail_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_campaigns" ADD CONSTRAINT "mail_campaigns_tenant_id_account_id_fkey" FOREIGN KEY ("tenant_id", "account_id") REFERENCES "mail_accounts"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_deliveries" ADD CONSTRAINT "mail_deliveries_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "mail_campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_workflows" ADD CONSTRAINT "internal_workflows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_tenant_id_workflow_id_fkey" FOREIGN KEY ("tenant_id", "workflow_id") REFERENCES "internal_workflows"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

