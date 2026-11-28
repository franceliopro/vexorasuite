-- Formação do professor na Gestão escolar (tenant-scoped).
-- Idempotente: cobre bancos onde a migration antiga ainda não foi aplicada.
-- Nenhum dado de outra empresa é copiado e nenhuma ação externa é executada.

ALTER TABLE "school_people"
    ADD COLUMN IF NOT EXISTS "formation" TEXT;

COMMENT ON COLUMN "school_people"."formation" IS 'Formação informada pelo professor (apenas kind=TEACHER).';
