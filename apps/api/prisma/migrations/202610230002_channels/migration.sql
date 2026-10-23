CREATE TABLE "channel_connections" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'WAHA',
  "name" TEXT NOT NULL,
  "session_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CONNECTING',
  "last_error" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "conversations" ADD COLUMN "channel_connection_id" UUID;
CREATE UNIQUE INDEX "contacts_tenant_id_external_id_key" ON "contacts"("tenant_id", "external_id");
CREATE UNIQUE INDEX "channel_connections_session_name_key" ON "channel_connections"("session_name");
CREATE INDEX "channel_connections_tenant_id_status_idx" ON "channel_connections"("tenant_id", "status");
CREATE INDEX "conversations_tenant_id_channel_connection_id_status_idx" ON "conversations"("tenant_id", "channel_connection_id", "status");
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channel_connection_id_fkey" FOREIGN KEY ("channel_connection_id") REFERENCES "channel_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
