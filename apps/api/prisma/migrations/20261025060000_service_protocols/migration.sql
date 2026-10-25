CREATE TABLE "service_protocols" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_protocols_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "service_protocols_conversation_id_key" ON "service_protocols"("conversation_id");
CREATE UNIQUE INDEX "service_protocols_tenant_id_code_key" ON "service_protocols"("tenant_id", "code");
CREATE INDEX "service_protocols_tenant_id_created_at_idx" ON "service_protocols"("tenant_id", "created_at");
ALTER TABLE "service_protocols" ADD CONSTRAINT "service_protocols_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_protocols" ADD CONSTRAINT "service_protocols_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
