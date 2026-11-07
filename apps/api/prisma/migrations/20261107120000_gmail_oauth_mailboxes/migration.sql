ALTER TABLE "email_mailboxes"
  ALTER COLUMN "imap_password_encrypted" DROP NOT NULL,
  ADD COLUMN "auth_mode" TEXT NOT NULL DEFAULT 'PASSWORD',
  ADD COLUMN "google_connection_id" UUID;

CREATE INDEX "email_mailboxes_tenant_id_google_connection_id_idx"
  ON "email_mailboxes"("tenant_id", "google_connection_id");

ALTER TABLE "email_mailboxes"
  ADD CONSTRAINT "email_mailboxes_google_connection_id_fkey"
  FOREIGN KEY ("google_connection_id") REFERENCES "google_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

