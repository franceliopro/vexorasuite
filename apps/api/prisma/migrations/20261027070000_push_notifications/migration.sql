CREATE TABLE "push_configurations" (
 "tenant_id" UUID NOT NULL PRIMARY KEY REFERENCES "tenants"("id") ON DELETE CASCADE,
 "public_key" TEXT NOT NULL,
 "private_key_encrypted" TEXT NOT NULL
);
CREATE TABLE "push_subscriptions" (
 "id" UUID NOT NULL PRIMARY KEY,
 "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
 "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "endpoint_hash" TEXT NOT NULL UNIQUE,
 "endpoint" TEXT NOT NULL,
 "p256dh" TEXT NOT NULL,
 "auth" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "last_test_at" TIMESTAMP(3)
);
CREATE INDEX "push_subscriptions_tenant_id_user_id_idx" ON "push_subscriptions"("tenant_id","user_id");
