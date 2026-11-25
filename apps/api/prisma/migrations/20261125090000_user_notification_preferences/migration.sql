-- Preferências por atendente sobre eventos que o produto já emite.
-- Não cria canais de entrega: apenas filtra avisos internos/push existentes.
CREATE TABLE "user_notification_preferences" (
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "events" TEXT[] NOT NULL DEFAULT ARRAY[
        'CONVERSATION_ASSIGNED_TO_ME',
        'CONVERSATION_ASSIGNED_TO_MY_TEAM',
        'MENTION',
        'TASK_DUE',
        'CONVERSATION_MESSAGE_RECEIVED'
    ]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("tenant_id", "user_id")
);

CREATE INDEX "user_notification_preferences_tenant_id_idx" ON "user_notification_preferences"("tenant_id");

ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
