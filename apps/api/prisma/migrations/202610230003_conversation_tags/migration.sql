CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7467e8',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_tags" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tags_tenant_id_name_key" ON "tags"("tenant_id", "name");
CREATE INDEX "tags_tenant_id_created_at_idx" ON "tags"("tenant_id", "created_at");
CREATE UNIQUE INDEX "conversation_tags_conversation_id_tag_id_key" ON "conversation_tags"("conversation_id", "tag_id");
CREATE INDEX "conversation_tags_tag_id_idx" ON "conversation_tags"("tag_id");

ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_tags" ADD CONSTRAINT "conversation_tags_tag_id_fkey"
FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
