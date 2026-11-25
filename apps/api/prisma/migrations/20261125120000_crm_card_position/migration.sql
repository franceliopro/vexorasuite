-- Posição deliberada dos cartões dentro de cada pipeline/etapa do CRM.
ALTER TABLE "contacts" ADD COLUMN "crm_position" INTEGER;

-- A ordem anterior (updatedAt desc) é preservada como posição inicial.
UPDATE "contacts" AS c
SET "crm_position" = ordered.position
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, pipeline_id, metadata->>'crmStage'
      ORDER BY updated_at DESC, id
    ) - 1 AS position
  FROM "contacts"
  WHERE metadata->>'crmStage' IS NOT NULL
) AS ordered
WHERE c.id = ordered.id;

CREATE INDEX "contacts_tenant_id_pipeline_id_crm_position_idx"
  ON "contacts" ("tenant_id", "pipeline_id", "crm_position");
