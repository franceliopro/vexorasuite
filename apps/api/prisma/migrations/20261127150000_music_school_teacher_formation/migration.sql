-- Formação do professor na Escola de Música e Instrumentos.
-- Professores cadastrados (kind=TEACHER) podem informar sua formação.
-- Nenhum dado de outra empresa é copiado ou alterado; apenas o tenant explícito.

ALTER TABLE "school_people"
    ADD COLUMN "formation" TEXT;

COMMENT ON COLUMN "school_people"."formation" IS 'Formação do professor (ex.: graduação, curso, instrumento). Apenas para kind=TEACHER.';
