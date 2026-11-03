CREATE TABLE "realtime_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "realtime_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "realtime_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "realtime_events_tenant_cursor_idx"
  ON "realtime_events" ("tenant_id", "occurred_at");

CREATE INDEX "realtime_events_expiry_idx"
  ON "realtime_events" ("expires_at");
