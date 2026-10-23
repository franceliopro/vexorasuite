CREATE TYPE "ConversationHandlingMode" AS ENUM ('BOT', 'HUMAN');

ALTER TABLE "channel_connections"
  ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "conversations"
  ADD COLUMN "department_id" UUID,
  ADD COLUMN "handling_mode" "ConversationHandlingMode" NOT NULL DEFAULT 'BOT';

CREATE TABLE "departments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_tenant_id_key_key" ON "departments"("tenant_id", "key");
CREATE INDEX "departments_tenant_id_is_active_idx" ON "departments"("tenant_id", "is_active");
CREATE INDEX "conversations_tenant_id_department_id_status_idx" ON "conversations"("tenant_id", "department_id", "status");

ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
