-- Gestão escolar simplificada (music-school): cadastro individual, responsáveis e vínculo Asaas pendente.
-- Idempotente e tenant-scoped. Nenhum cliente é criado no Asaas, nenhuma mensagem é enviada e nenhuma cobrança é executada.

-- Foto do curso pode vir do computador (data URL local) ou de uma URL https já configurada.
ALTER TABLE "school_courses" DROP CONSTRAINT IF EXISTS "school_courses_image_url_check";
ALTER TABLE "school_courses"
    ADD CONSTRAINT "school_courses_image_url_check"
        CHECK ("image_url" IS NULL
            OR "image_url" ~ '^https://'
            OR "image_url" ~ '^data:image/(webp|png|jpeg);base64,');

-- Pessoas: aluno, professor ou responsável. A mesma pessoa pode acumular papéis por vínculos.
ALTER TABLE "school_people"
    ADD COLUMN IF NOT EXISTS "cpf" TEXT,
    ADD COLUMN IF NOT EXISTS "address_line" TEXT,
    ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "asaas_customer_id" TEXT,
    ADD COLUMN IF NOT EXISTS "asaas_sync_status" TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE "school_people" DROP CONSTRAINT IF EXISTS "school_people_kind_check";
ALTER TABLE "school_people"
    ADD CONSTRAINT "school_people_kind_check"
        CHECK ("kind" IN ('STUDENT','TEACHER','RESPONSIBLE'));

ALTER TABLE "school_people" DROP CONSTRAINT IF EXISTS "school_people_asaas_sync_check";
ALTER TABLE "school_people"
    ADD CONSTRAINT "school_people_asaas_sync_check"
        CHECK ("asaas_sync_status" IN ('PENDING','LINKED','FAILED'));

-- Plano individual interno: turno/período da aula, sem "turma" na interface.
ALTER TABLE "school_classes"
    ADD COLUMN IF NOT EXISTS "period" TEXT;

ALTER TABLE "school_classes" DROP CONSTRAINT IF EXISTS "school_classes_period_check";
ALTER TABLE "school_classes"
    ADD CONSTRAINT "school_classes_period_check"
        CHECK ("period" IS NULL OR "period" IN ('MANHA','TARDE','NOITE'));

-- Matrícula individual: quem paga (aluno ou responsável) e estado do vínculo com o Asaas.
ALTER TABLE "school_enrollments"
    ADD COLUMN IF NOT EXISTS "contract_period" TEXT,
    ADD COLUMN IF NOT EXISTS "billing_mode" TEXT NOT NULL DEFAULT 'STUDENT',
    ADD COLUMN IF NOT EXISTS "billing_person_id" UUID,
    ADD COLUMN IF NOT EXISTS "asaas_customer_id" TEXT,
    ADD COLUMN IF NOT EXISTS "asaas_sync_status" TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE "school_enrollments" DROP CONSTRAINT IF EXISTS "school_enrollments_billing_mode_check";
ALTER TABLE "school_enrollments"
    ADD CONSTRAINT "school_enrollments_billing_mode_check"
        CHECK ("billing_mode" IN ('STUDENT','GUARDIAN'));

ALTER TABLE "school_enrollments" DROP CONSTRAINT IF EXISTS "school_enrollments_contract_period_check";
ALTER TABLE "school_enrollments"
    ADD CONSTRAINT "school_enrollments_contract_period_check"
        CHECK ("contract_period" IS NULL OR "contract_period" IN ('MONTHLY','QUARTERLY','SEMESTER','YEARLY'));

ALTER TABLE "school_enrollments" DROP CONSTRAINT IF EXISTS "school_enrollments_asaas_sync_check";
ALTER TABLE "school_enrollments"
    ADD CONSTRAINT "school_enrollments_asaas_sync_check"
        CHECK ("asaas_sync_status" IN ('PENDING','LINKED','FAILED'));

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_enrollments_billing_person_id_fkey') THEN
        ALTER TABLE "school_enrollments"
            ADD CONSTRAINT "school_enrollments_billing_person_id_fkey"
            FOREIGN KEY ("billing_person_id") REFERENCES "school_people"("id") ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "school_enrollments_tenant_billing_person_idx"
    ON "school_enrollments"("tenant_id", "billing_person_id");

-- Link público carrega somente a configuração da aula. O plano individual é criado no servidor
-- depois da assinatura confirmada; a interface nunca mostra "turma".
ALTER TABLE "school_enrollment_links"
    ADD COLUMN IF NOT EXISTS "teacher_id" UUID,
    ADD COLUMN IF NOT EXISTS "weekday" INTEGER,
    ADD COLUMN IF NOT EXISTS "start_time" TEXT,
    ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER,
    ADD COLUMN IF NOT EXISTS "period" TEXT,
    ADD COLUMN IF NOT EXISTS "contract_period" TEXT,
    ADD COLUMN IF NOT EXISTS "contracted_sessions" INTEGER;

ALTER TABLE "school_enrollment_links" DROP CONSTRAINT IF EXISTS "school_enrollment_links_weekday_check";
ALTER TABLE "school_enrollment_links"
    ADD CONSTRAINT "school_enrollment_links_weekday_check"
        CHECK ("weekday" IS NULL OR "weekday" BETWEEN 1 AND 7);

ALTER TABLE "school_enrollment_links" DROP CONSTRAINT IF EXISTS "school_enrollment_links_duration_check";
ALTER TABLE "school_enrollment_links"
    ADD CONSTRAINT "school_enrollment_links_duration_check"
        CHECK ("duration_minutes" IS NULL OR "duration_minutes" BETWEEN 30 AND 240);

ALTER TABLE "school_enrollment_links" DROP CONSTRAINT IF EXISTS "school_enrollment_links_period_check";
ALTER TABLE "school_enrollment_links"
    ADD CONSTRAINT "school_enrollment_links_period_check"
        CHECK ("period" IS NULL OR "period" IN ('MANHA','TARDE','NOITE'));

ALTER TABLE "school_enrollment_links" DROP CONSTRAINT IF EXISTS "school_enrollment_links_contract_period_check";
ALTER TABLE "school_enrollment_links"
    ADD CONSTRAINT "school_enrollment_links_contract_period_check"
        CHECK ("contract_period" IS NULL OR "contract_period" IN ('MONTHLY','QUARTERLY','SEMESTER','YEARLY'));

ALTER TABLE "school_enrollment_links" DROP CONSTRAINT IF EXISTS "school_enrollment_links_contracted_sessions_check";
ALTER TABLE "school_enrollment_links"
    ADD CONSTRAINT "school_enrollment_links_contracted_sessions_check"
        CHECK ("contracted_sessions" IS NULL OR "contracted_sessions" BETWEEN 1 AND 1000);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_enrollment_links_teacher_id_fkey') THEN
        ALTER TABLE "school_enrollment_links"
            ADD CONSTRAINT "school_enrollment_links_teacher_id_fkey"
            FOREIGN KEY ("teacher_id") REFERENCES "school_people"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- Responsável pode ser uma pessoa cadastrada (reutilizável para vários alunos) ou dados avulsos do PDF.
ALTER TABLE "school_guardians"
    ADD COLUMN IF NOT EXISTS "person_id" UUID,
    ADD COLUMN IF NOT EXISTS "is_billing_client" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_guardians_person_id_fkey') THEN
        ALTER TABLE "school_guardians"
            ADD CONSTRAINT "school_guardians_person_id_fkey"
            FOREIGN KEY ("person_id") REFERENCES "school_people"("id") ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "school_guardians_tenant_person_idx"
    ON "school_guardians"("tenant_id", "person_id");

COMMENT ON COLUMN "school_enrollments"."billing_mode" IS 'STUDENT = o aluno é o cliente; GUARDIAN = o responsável cadastrado é o cliente do Asaas.';
COMMENT ON COLUMN "school_enrollments"."asaas_sync_status" IS 'PENDING até haver credencial, consentimento e confirmação do Asaas; nunca é marcado como LINKED por esta migração.';
