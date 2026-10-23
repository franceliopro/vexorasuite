ALTER TABLE "tenants" ADD COLUMN "integrations" JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE "department_members" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "department_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "department_members_department_id_user_id_key" ON "department_members"("department_id", "user_id");
CREATE INDEX "department_members_tenant_id_user_id_idx" ON "department_members"("tenant_id", "user_id");
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "department_members" ADD CONSTRAINT "department_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "conversation_participants" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'INVITED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");
CREATE INDEX "conversation_participants_tenant_id_user_id_idx" ON "conversation_participants"("tenant_id", "user_id");
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD COLUMN "archived_at" TIMESTAMP(3), ADD COLUMN "deleted_at" TIMESTAMP(3), ADD COLUMN "bot_state" JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX "conversations_tenant_id_archived_at_deleted_at_idx" ON "conversations"("tenant_id", "archived_at", "deleted_at");

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'ASAAS',
  "external_id" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "billing_type" TEXT,
  "invoice_url" TEXT,
  "bank_slip_url" TEXT,
  "pix_payload" TEXT,
  "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payments_tenant_id_provider_external_id_key" ON "payments"("tenant_id", "provider", "external_id");
CREATE INDEX "payments_tenant_id_conversation_id_created_at_idx" ON "payments"("tenant_id", "conversation_id", "created_at");
CREATE INDEX "payments_tenant_id_status_idx" ON "payments"("tenant_id", "status");
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
