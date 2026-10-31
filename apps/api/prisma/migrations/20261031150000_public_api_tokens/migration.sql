CREATE TABLE "public_api_tokens" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "last_used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_api_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_api_tokens_token_hash_key" ON "public_api_tokens"("token_hash");
CREATE INDEX "public_api_tokens_tenant_id_revoked_at_idx" ON "public_api_tokens"("tenant_id", "revoked_at");

ALTER TABLE "public_api_tokens"
  ADD CONSTRAINT "public_api_tokens_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
