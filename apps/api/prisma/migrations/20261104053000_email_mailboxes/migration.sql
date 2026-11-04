CREATE TABLE "email_mailboxes" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "channel_connection_id" UUID NOT NULL,
  "address" TEXT NOT NULL,
  "imap_host" TEXT NOT NULL,
  "imap_port" INTEGER NOT NULL DEFAULT 993,
  "imap_secure" BOOLEAN NOT NULL DEFAULT true,
  "imap_user" TEXT NOT NULL,
  "imap_password_encrypted" TEXT NOT NULL,
  "imap_mailbox" TEXT NOT NULL DEFAULT 'INBOX',
  "smtp_host" TEXT,
  "smtp_port" INTEGER,
  "smtp_secure" BOOLEAN,
  "smtp_user" TEXT,
  "smtp_password_encrypted" TEXT,
  "smtp_from" TEXT,
  "smtp_from_name" TEXT,
  "sync_uid_validity" INTEGER,
  "sync_last_uid" INTEGER NOT NULL DEFAULT 0,
  "last_sync_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'DISABLED',
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "email_mailboxes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "conversations" ADD COLUMN "email_thread_key" TEXT;

CREATE UNIQUE INDEX "email_mailboxes_channel_connection_id_key" ON "email_mailboxes"("channel_connection_id");
CREATE UNIQUE INDEX "email_mailboxes_tenant_id_address_key" ON "email_mailboxes"("tenant_id", "address");
CREATE INDEX "email_mailboxes_tenant_id_status_idx" ON "email_mailboxes"("tenant_id", "status");
CREATE INDEX "conversations_tenant_id_channel_connection_id_email_thread_key_idx" ON "conversations"("tenant_id", "channel_connection_id", "email_thread_key");

ALTER TABLE "email_mailboxes" ADD CONSTRAINT "email_mailboxes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_mailboxes" ADD CONSTRAINT "email_mailboxes_channel_connection_id_fkey" FOREIGN KEY ("channel_connection_id") REFERENCES "channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
