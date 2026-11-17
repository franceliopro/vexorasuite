CREATE TABLE "service_offers" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "conversation_id" UUID NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "public_token_hash" CHAR(64) NOT NULL,
  "seller_name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "setup_cents" INTEGER NOT NULL,
  "monthly_cents" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'OPEN',
  "customer_reply" TEXT,
  "accepted_by" TEXT,
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_offers_public_token_hash_key" ON "service_offers" ("public_token_hash");
CREATE INDEX "service_offers_tenant_id_conversation_id_created_at_idx" ON "service_offers" ("tenant_id", "conversation_id", "created_at");

CREATE TABLE "service_orders" (
  "id" UUID NOT NULL,
  "offer_id" UUID NOT NULL REFERENCES "service_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduled_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "installation" TEXT,
  CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_orders_offer_id_key" ON "service_orders" ("offer_id");
