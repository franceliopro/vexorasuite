ALTER TABLE "memberships" ADD COLUMN "known_by" TEXT NOT NULL DEFAULT '';
CREATE TABLE "internal_mentions" (
 "id" UUID NOT NULL,
 "tenant_id" UUID NOT NULL,
 "conversation_id" UUID NOT NULL,
 "message_id" UUID NOT NULL,
 "user_id" UUID NOT NULL,
 "read_at" TIMESTAMP(3),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "internal_mentions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "internal_mentions_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
 CONSTRAINT "internal_mentions_conversation_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
 CONSTRAINT "internal_mentions_message_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
 CONSTRAINT "internal_mentions_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "internal_mentions_message_id_user_id_key" ON "internal_mentions"("message_id","user_id");
CREATE INDEX "internal_mentions_tenant_id_user_id_created_at_idx" ON "internal_mentions"("tenant_id","user_id","created_at");
