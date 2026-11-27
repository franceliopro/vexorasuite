CREATE TABLE "music_classes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "instrument" TEXT,
  "department_id" UUID NOT NULL,
  "weekday" INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  "start_time" TEXT NOT NULL CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  "duration_minutes" INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 30 AND 180),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "music_classes_tenant_active_idx" ON "music_classes" ("tenant_id", "active");
CREATE INDEX "music_classes_tenant_department_idx" ON "music_classes" ("tenant_id", "department_id");

CREATE TABLE "music_enrollments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "class_id" UUID NOT NULL REFERENCES "music_classes"("id") ON DELETE CASCADE,
  "contact_id" UUID NOT NULL,
  "contracted_sessions" INTEGER NOT NULL CHECK (contracted_sessions BETWEEN 1 AND 1000),
  "purchased_sessions" INTEGER NOT NULL DEFAULT 0 CHECK (purchased_sessions BETWEEN 0 AND 1000),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
  "billing_amount_cents" INTEGER,
  "billing_cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
  "billing_status" TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (billing_status IN ('SCHEDULED','SENT','CONFIRMED','FAILED')),
  "billing_next_due_date" DATE,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "music_enrollments_tenant_class_contact_key" UNIQUE ("tenant_id", "class_id", "contact_id")
);
CREATE INDEX "music_enrollments_tenant_contact_idx" ON "music_enrollments" ("tenant_id", "contact_id");
CREATE INDEX "music_enrollments_tenant_status_idx" ON "music_enrollments" ("tenant_id", "status");

CREATE TABLE "music_attendances" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "class_id" UUID NOT NULL REFERENCES "music_classes"("id") ON DELETE CASCADE,
  "enrollment_id" UUID NOT NULL REFERENCES "music_enrollments"("id") ON DELETE CASCADE,
  "session_date" DATE NOT NULL,
  "outcome" TEXT NOT NULL CHECK (outcome IN ('ATTENDED','STUDENT_ABSENT','TEACHER_ABSENT','CANCELLED','MAKEUP')),
  "note" TEXT,
  "recorded_by_id" UUID NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "music_attendances_tenant_enrollment_date_key" UNIQUE ("tenant_id", "enrollment_id", "session_date")
);
CREATE INDEX "music_attendances_tenant_class_date_idx" ON "music_attendances" ("tenant_id", "class_id", "session_date");

COMMENT ON COLUMN "music_enrollments"."billing_status" IS 'SCHEDULED não confirma cobrança; SENT/CONFIRMED/FAILED exigem evidência do provedor.';
COMMENT ON COLUMN "music_attendances"."outcome" IS 'ATTENDED e STUDENT_ABSENT consomem aula; TEACHER_ABSENT e CANCELLED geram reposição; MAKEUP consome e quita uma reposição.';