CREATE TABLE "document_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL DEFAULT 'QUOTE',
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "variables" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "body" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "document_templates_tenant_kind_idx" ON "document_templates" ("tenant_id", "kind");

CREATE TABLE "generated_documents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "template_id" UUID NOT NULL REFERENCES "document_templates" ("id"),
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "contact_id" UUID,
  "contact_name" TEXT,
  "values" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "content" TEXT NOT NULL,
  "sent_at" TIMESTAMPTZ,
  "sent_to" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "generated_documents_tenant_created_idx" ON "generated_documents" ("tenant_id", "created_at", "id");
