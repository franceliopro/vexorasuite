CREATE TABLE "contact_identities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "phone" TEXT,
    "display_name" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_identities_tenant_id_provider_external_id_key"
    ON "contact_identities"("tenant_id", "provider", "external_id");
CREATE INDEX "contact_identities_tenant_id_contact_id_idx"
    ON "contact_identities"("tenant_id", "contact_id");
CREATE INDEX "contact_identities_tenant_id_provider_phone_idx"
    ON "contact_identities"("tenant_id", "provider", "phone");

ALTER TABLE "contact_identities"
    ADD CONSTRAINT "contact_identities_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_identities"
    ADD CONSTRAINT "contact_identities_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "contact_identities" (
    "id", "tenant_id", "contact_id", "provider", "external_id", "phone", "display_name", "metadata", "first_seen_at", "last_seen_at", "created_at", "updated_at"
)
SELECT
    md5(random()::text || clock_timestamp()::text || c."id"::text)::uuid,
    c."tenant_id",
    c."id",
    COALESCE(NULLIF(c."metadata"->>'provider', ''), CASE WHEN c."external_id" LIKE '%@c.us' OR c."source" ILIKE '%whatsapp%' THEN 'WAHA' ELSE 'LEGACY' END),
    c."external_id",
    c."phone",
    c."name",
    c."metadata",
    c."created_at",
    c."updated_at",
    c."created_at",
    c."updated_at"
FROM "contacts" c
WHERE c."external_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "contact_identities" i
    WHERE i."tenant_id" = c."tenant_id"
      AND i."provider" = COALESCE(NULLIF(c."metadata"->>'provider', ''), CASE WHEN c."external_id" LIKE '%@c.us' OR c."source" ILIKE '%whatsapp%' THEN 'WAHA' ELSE 'LEGACY' END)
      AND i."external_id" = c."external_id"
  );
