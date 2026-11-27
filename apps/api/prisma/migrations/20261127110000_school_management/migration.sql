-- Gestão escolar no banco principal: todas as tabelas são tenant-scoped.
-- Identificadores de outras entidades são UUIDs validados na aplicação;
-- nenhuma credencial, aluno, professor ou conteúdo é copiado entre empresas.

CREATE TABLE "school_courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "kind" TEXT NOT NULL DEFAULT 'COURSE',
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_courses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_courses_tenant_kind_name_key" UNIQUE ("tenant_id", "kind", "name"),
    CONSTRAINT "school_courses_kind_check" CHECK ("kind" IN ('COURSE','SUBJECT'))
);
CREATE INDEX "school_courses_tenant_kind_active_idx" ON "school_courses"("tenant_id", "kind", "active");
CREATE INDEX "school_courses_tenant_parent_idx" ON "school_courses"("tenant_id", "parent_id");
COMMENT ON TABLE "school_courses" IS 'Cursos e matérias da escola. SUBJECT.parent_id aponta para o COURSE.';

CREATE TABLE "school_people" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "kind" TEXT NOT NULL DEFAULT 'STUDENT',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_people_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_people_kind_check" CHECK ("kind" IN ('STUDENT','TEACHER'))
);
CREATE INDEX "school_people_tenant_kind_active_idx" ON "school_people"("tenant_id", "kind", "active");
CREATE INDEX "school_people_tenant_name_idx" ON "school_people"("tenant_id", "name");
COMMENT ON TABLE "school_people" IS 'Alunos e professores próprios da escola, isolados por tenant.';

CREATE TABLE "school_rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_rooms_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_rooms_tenant_name_key" UNIQUE ("tenant_id", "name"),
    CONSTRAINT "school_rooms_capacity_check" CHECK ("capacity" BETWEEN 1 AND 500)
);
CREATE INDEX "school_rooms_tenant_active_idx" ON "school_rooms"("tenant_id", "active");

CREATE TABLE "school_classes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "course_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "room_id" UUID,
    "name" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_classes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_classes_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
    CONSTRAINT "school_classes_start_time_check" CHECK ("start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT "school_classes_duration_check" CHECK ("duration_minutes" BETWEEN 30 AND 240)
);
CREATE INDEX "school_classes_tenant_course_idx" ON "school_classes"("tenant_id", "course_id");
CREATE INDEX "school_classes_tenant_teacher_idx" ON "school_classes"("tenant_id", "teacher_id");
CREATE INDEX "school_classes_tenant_active_idx" ON "school_classes"("tenant_id", "active");
COMMENT ON TABLE "school_classes" IS 'Turma com matéria, professor, sala e recorrência semanal determinística.';

CREATE TABLE "school_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "class_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "contracted_sessions" INTEGER NOT NULL,
    "purchased_sessions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tuition_amount_cents" INTEGER,
    "tuition_cycle" TEXT DEFAULT 'MONTHLY',
    "tuition_status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "tuition_next_due_date" DATE,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_enrollments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_enrollments_tenant_class_student_key" UNIQUE ("tenant_id", "class_id", "student_id"),
    CONSTRAINT "school_enrollments_contracted_check" CHECK ("contracted_sessions" BETWEEN 1 AND 1000),
    CONSTRAINT "school_enrollments_purchased_check" CHECK ("purchased_sessions" BETWEEN 0 AND 1000),
    CONSTRAINT "school_enrollments_status_check" CHECK ("status" IN ('ACTIVE','SUSPENDED')),
    CONSTRAINT "school_enrollments_tuition_status_check" CHECK ("tuition_status" IN ('SCHEDULED','SENT','CONFIRMED','FAILED'))
);
CREATE INDEX "school_enrollments_tenant_student_idx" ON "school_enrollments"("tenant_id", "student_id");
CREATE INDEX "school_enrollments_tenant_tuition_status_idx" ON "school_enrollments"("tenant_id", "tuition_status");
COMMENT ON COLUMN "school_enrollments"."tuition_status" IS 'SCHEDULED não confirma cobrança; SENT/CONFIRMED/FAILED exigem evidência do provedor.';

CREATE TABLE "school_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "class_id" UUID NOT NULL,
    "session_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_sessions_tenant_class_date_key" UNIQUE ("tenant_id", "class_id", "session_date"),
    CONSTRAINT "school_sessions_status_check" CHECK ("status" IN ('SCHEDULED','HELD','CANCELLED'))
);
CREATE INDEX "school_sessions_tenant_date_idx" ON "school_sessions"("tenant_id", "session_date");

CREATE TABLE "school_attendances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "session_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "person_kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_attendances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_attendances_tenant_session_person_key" UNIQUE ("tenant_id", "session_id", "person_kind", "person_id"),
    CONSTRAINT "school_attendances_person_kind_check" CHECK ("person_kind" IN ('STUDENT','TEACHER')),
    CONSTRAINT "school_attendances_status_check" CHECK ("status" IN ('PRESENT','ABSENT','JUSTIFIED','MAKEUP','CANCELLED'))
);
CREATE INDEX "school_attendances_tenant_session_idx" ON "school_attendances"("tenant_id", "session_id");
CREATE INDEX "school_attendances_tenant_person_status_idx" ON "school_attendances"("tenant_id", "person_id", "status");
COMMENT ON COLUMN "school_attendances"."status" IS 'PRESENT/JUSTIFIED/MAKEUP consomem aula; ABSENT do aluno consome; ABSENT do professor e CANCELLED geram reposição.';

CREATE TABLE "school_lesson_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "class_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objective_html" TEXT NOT NULL,
    "content_html" TEXT NOT NULL,
    "activities_html" TEXT NOT NULL,
    "observations_html" TEXT NOT NULL,
    "materials" JSONB NOT NULL DEFAULT '[]',
    "youtube_urls" JSONB NOT NULL DEFAULT '[]',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_lesson_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_lesson_plans_tenant_class_version_key" UNIQUE ("tenant_id", "class_id", "version"),
    CONSTRAINT "school_lesson_plans_version_check" CHECK ("version" BETWEEN 1 AND 10000)
);
CREATE INDEX "school_lesson_plans_tenant_class_idx" ON "school_lesson_plans"("tenant_id", "class_id");
COMMENT ON TABLE "school_lesson_plans" IS 'Plano de aula em richtext com histórico de versões e links do YouTube validados.';

CREATE TABLE "school_grades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "class_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "evaluation_date" DATE NOT NULL,
    "max_score" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_grades_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_grades_tenant_class_student_title_key" UNIQUE ("tenant_id", "class_id", "student_id", "title"),
    CONSTRAINT "school_grades_max_score_check" CHECK ("max_score" BETWEEN 1 AND 1000),
    CONSTRAINT "school_grades_score_check" CHECK ("score" >= 0 AND "score" <= "max_score")
);
CREATE INDEX "school_grades_tenant_student_idx" ON "school_grades"("tenant_id", "student_id");

CREATE TABLE "school_guardians" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "student_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_guardians_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_guardians_relationship_check" CHECK ("relationship" IS NULL OR "relationship" IN ('MAE','PAI','RESPONSAVEL','OUTRO'))
);
CREATE INDEX "school_guardians_tenant_student_idx" ON "school_guardians"("tenant_id", "student_id");

CREATE TABLE "school_notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "student_id" UUID,
    "class_id" UUID,
    "title" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMPTZ,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_notices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_notices_channel_check" CHECK ("channel" IN ('WHATSAPP','EMAIL')),
    CONSTRAINT "school_notices_status_check" CHECK ("status" IN ('SCHEDULED'))
);
CREATE INDEX "school_notices_tenant_status_idx" ON "school_notices"("tenant_id", "status");
CREATE INDEX "school_notices_tenant_student_idx" ON "school_notices"("tenant_id", "student_id");
COMMENT ON COLUMN "school_notices"."status" IS 'Aviso fica apenas SCHEDULED: nenhum envio é executado por esta fatia.';

CREATE TABLE "school_materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "lesson_plan_id" UUID,
    "course_id" UUID,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LINK',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "school_materials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "school_materials_kind_check" CHECK ("kind" IN ('LINK','FILE','YOUTUBE'))
);
CREATE INDEX "school_materials_tenant_plan_idx" ON "school_materials"("tenant_id", "lesson_plan_id");
CREATE INDEX "school_materials_tenant_course_idx" ON "school_materials"("tenant_id", "course_id");
