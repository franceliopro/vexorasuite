CREATE TABLE "zernio_profiles" ("tenant_id" UUID NOT NULL, "profile_id" TEXT NOT NULL, "external_id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "zernio_profiles_pkey" PRIMARY KEY ("tenant_id"));
CREATE UNIQUE INDEX "zernio_profiles_profile_id_key" ON "zernio_profiles"("profile_id");
CREATE UNIQUE INDEX "zernio_profiles_external_id_key" ON "zernio_profiles"("external_id");
ALTER TABLE "zernio_profiles" ADD CONSTRAINT "zernio_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "zernio_oauth_attempts" ("state_hash" TEXT NOT NULL, "tenant_id" UUID NOT NULL, "user_id" UUID NOT NULL, "profile_id" TEXT NOT NULL, "platform" TEXT NOT NULL, "expires_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "zernio_oauth_attempts_pkey" PRIMARY KEY ("state_hash"));
CREATE INDEX "zernio_oauth_attempts_expires_at_idx" ON "zernio_oauth_attempts"("expires_at");
CREATE INDEX "zernio_oauth_attempts_profile_id_idx" ON "zernio_oauth_attempts"("profile_id");
ALTER TABLE "zernio_oauth_attempts" ADD CONSTRAINT "zernio_oauth_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "zernio_oauth_attempts" ADD CONSTRAINT "zernio_oauth_attempts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "zernio_profiles"("profile_id") ON DELETE CASCADE ON UPDATE CASCADE;
