-- Catálogo escolar com foto/detalhes e fluxo de matrícula externa.
-- Nenhuma mensagem, assinatura, publicação ou cobrança é executada por esta migração.
-- Toda tabela é tenant-scoped; o token público nunca infere tenant de parâmetro do visitante.

ALTER TABLE "school_courses"
    ADD COLUMN "image_url" TEXT,
    ADD COLUMN "summary" TEXT,
    ADD COLUMN "level" TEXT,
    ADD COLUMN "duration_label" TEXT,
    ADD COLUMN "tuition_amount_cents" INTEGER;

ALTER TABLE "school_courses"
    ADD CONSTRAINT "school_courses_image_url_check"
        CHECK ("image_url" IS NULL OR "image_url" ~ '^https://'),
    ADD CONSTRAINT "school_courses_tuition_check"
        CHECK ("tuition_amount_cents" IS NULL OR "tuition_amount_cents" >= 0);

CREATE TABLE "school_enrollment_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "token" TEXT NOT NULL,
    "course_id" UUID,
    "class_id" UUID,
    "owner_name" TEXT NOT NULL,
    "owner_phone" TEXT,
    "owner_email" TEXT,
    "welcome_message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_enrollment_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_enrollment_links_token_key" UNIQUE ("token"),
    CONSTRAINT "school_enrollment_links_status_check"
        CHECK ("status" IN ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
    CONSTRAINT "school_enrollment_links_owner_check" CHECK (length("owner_name") BETWEEN 2 AND 120)
);
CREATE INDEX "school_enrollment_links_tenant_status_idx" ON "school_enrollment_links"("tenant_id", "status");
CREATE INDEX "school_enrollment_links_tenant_created_idx" ON "school_enrollment_links"("tenant_id", "created_at");
COMMENT ON TABLE "school_enrollment_links" IS 'Link público por tenant. O token é a única credencial do visitante.';

CREATE TABLE "school_enrollment_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "source" TEXT NOT NULL DEFAULT 'DRIVE_MANUAL',
    "drive_file_id" TEXT,
    "configured_at" TIMESTAMPTZ,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_enrollment_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_enrollment_templates_tenant_kind_name_key" UNIQUE ("tenant_id", "kind", "name"),
    CONSTRAINT "school_enrollment_templates_kind_check" CHECK ("kind" IN ('CONTRACT','ENROLLMENT_FORM')),
    CONSTRAINT "school_enrollment_templates_source_check" CHECK ("source" IN ('DRIVE_MANUAL','DRIVE_API')),
    CONSTRAINT "school_enrollment_templates_body_check" CHECK (length("body_html") BETWEEN 20 AND 40000)
);
CREATE INDEX "school_enrollment_templates_tenant_kind_idx" ON "school_enrollment_templates"("tenant_id", "kind");
COMMENT ON COLUMN "school_enrollment_templates"."source" IS 'DRIVE_MANUAL = texto copiado do Google Drive. DRIVE_API exige importação autenticada e não é afirmada sem evidência.';

CREATE TABLE "school_enrollment_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "link_id" UUID NOT NULL REFERENCES "school_enrollment_links"("id") ON DELETE CASCADE,
    "student_name" TEXT NOT NULL,
    "student_cpf" TEXT,
    "student_email" TEXT,
    "student_phone" TEXT,
    "guardian_name" TEXT,
    "guardian_relationship" TEXT,
    "guardian_phone" TEXT,
    "guardian_email" TEXT,
    "address_line" TEXT,
    "course_id" UUID,
    "class_id" UUID,
    "instrument" TEXT,
    "level" TEXT,
    "start_date" DATE,
    "weekday" INTEGER,
    "start_time" TEXT,
    "tuition_amount_cents" INTEGER,
    "payment_method" TEXT,
    "observations" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "signing_url" TEXT,
    "envelope_id" TEXT,
    "document_id" TEXT,
    "signed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_enrollment_submissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_enrollment_submissions_status_check"
        CHECK ("status" IN ('DRAFT','PREPARED','WAITING_SIGNATURE','SIGNED_CONFIRMED','GENERATED','DELIVERY_FAILED','COMPLETED','FAILED')),
    CONSTRAINT "school_enrollment_submissions_weekday_check" CHECK ("weekday" IS NULL OR "weekday" BETWEEN 1 AND 7),
    CONSTRAINT "school_enrollment_submissions_tuition_check" CHECK ("tuition_amount_cents" IS NULL OR "tuition_amount_cents" >= 0)
);
CREATE INDEX "school_enrollment_submissions_tenant_created_idx" ON "school_enrollment_submissions"("tenant_id", "created_at");
CREATE INDEX "school_enrollment_submissions_tenant_status_idx" ON "school_enrollment_submissions"("tenant_id", "status");
CREATE INDEX "school_enrollment_submissions_link_idx" ON "school_enrollment_submissions"("link_id");
COMMENT ON COLUMN "school_enrollment_submissions"."status" IS 'Estados explícitos: configurado, preparado, aguardando assinatura, assinado confirmado, gerado, entrega falhou.';

CREATE TABLE "school_envelopes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "submission_id" UUID NOT NULL REFERENCES "school_enrollment_submissions"("id") ON DELETE CASCADE,
    "envelope_id" TEXT NOT NULL,
    "document_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "signing_url" TEXT,
    "error" TEXT,
    "raw" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "completed_at" TIMESTAMPTZ,
    CONSTRAINT "school_envelopes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_envelopes_envelope_key" UNIQUE ("envelope_id"),
    CONSTRAINT "school_envelopes_status_check" CHECK ("status" IN ('PREPARED','SENT','WAITING_SIGNATURE','COMPLETED','FAILED'))
);
CREATE INDEX "school_envelopes_tenant_status_idx" ON "school_envelopes"("tenant_id", "status");
CREATE INDEX "school_envelopes_submission_idx" ON "school_envelopes"("submission_id");

CREATE TABLE "school_enrollment_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "submission_id" UUID NOT NULL REFERENCES "school_enrollment_submissions"("id") ON DELETE CASCADE,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pdf_path" TEXT,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_enrollment_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_enrollment_documents_submission_kind_key" UNIQUE ("tenant_id", "submission_id", "kind"),
    CONSTRAINT "school_enrollment_documents_kind_check" CHECK ("kind" IN ('CONTRACT','ENROLLMENT_FORM'))
);

CREATE TABLE "school_enrollment_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "submission_id" UUID NOT NULL REFERENCES "school_enrollment_submissions"("id") ON DELETE CASCADE,
    "document_id" UUID NOT NULL REFERENCES "school_enrollment_documents"("id") ON DELETE CASCADE,
    "recipient_role" TEXT NOT NULL,
    "recipient_phone" TEXT,
    "recipient_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "message_id" TEXT,
    "error" TEXT,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_enrollment_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_enrollment_deliveries_role_check" CHECK ("recipient_role" IN ('CLIENT','OWNER')),
    CONSTRAINT "school_enrollment_deliveries_status_check" CHECK ("status" IN ('PREPARED','SENT','FAILED'))
);
CREATE INDEX "school_enrollment_deliveries_tenant_status_idx" ON "school_enrollment_deliveries"("tenant_id", "status");
CREATE INDEX "school_enrollment_deliveries_submission_idx" ON "school_enrollment_deliveries"("submission_id");
COMMENT ON TABLE "school_enrollment_deliveries" IS 'Somente status SENT com message_id representa envio confirmado; PREPARED não afirma disparo.';
