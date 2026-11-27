-- Token de leitura pública para a vitrine do catálogo, restrito ao tenant que o criou.
CREATE TABLE "storefront_tokens" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "last_used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "storefront_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storefront_tokens_token_hash_key" ON "storefront_tokens"("token_hash");
CREATE INDEX "storefront_tokens_tenant_id_revoked_at_idx" ON "storefront_tokens"("tenant_id", "revoked_at");

ALTER TABLE "storefront_tokens"
  ADD CONSTRAINT "storefront_tokens_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
