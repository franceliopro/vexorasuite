CREATE TABLE "creative_references" (
 "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "account_id" UUID,
 "file_id" TEXT NOT NULL, "name" TEXT NOT NULL, "mime_type" TEXT NOT NULL,
 "purpose" TEXT NOT NULL DEFAULT 'ALL', "instructions" TEXT NOT NULL DEFAULT '',
 "palette" JSONB NOT NULL DEFAULT '[]', "enabled" BOOLEAN NOT NULL DEFAULT true,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "creative_references_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "creative_references_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "creative_references_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "google_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "creative_references_tenant_id_account_id_file_id_key" ON "creative_references"("tenant_id","account_id","file_id");
CREATE INDEX "creative_references_tenant_id_enabled_purpose_idx" ON "creative_references"("tenant_id","enabled","purpose");
