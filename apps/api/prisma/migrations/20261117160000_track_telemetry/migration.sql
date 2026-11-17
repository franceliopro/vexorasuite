CREATE TABLE "track_devices" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_simulation" BOOLEAN NOT NULL DEFAULT TRUE,
  "department_id" UUID REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "track_devices_token_hash_key" ON "track_devices" ("token_hash");
CREATE UNIQUE INDEX "track_devices_tenant_id_reference_key" ON "track_devices" ("tenant_id", "reference");
CREATE INDEX "track_devices_tenant_id_created_at_id_idx" ON "track_devices" ("tenant_id", "created_at", "id");

CREATE TABLE "track_positions" (
  "id" UUID PRIMARY KEY,
  "device_id" UUID NOT NULL REFERENCES "track_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "event_id" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
  "longitude" DOUBLE PRECISION NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
  "speed_kph" DOUBLE PRECISION CHECK ("speed_kph" BETWEEN 0 AND 1000),
  "battery" DOUBLE PRECISION CHECK ("battery" BETWEEN 0 AND 100),
  "recorded_at" TIMESTAMP(3) NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "track_positions_device_id_event_id_key" ON "track_positions" ("device_id", "event_id");
CREATE INDEX "track_positions_device_id_recorded_at_received_at_id_idx" ON "track_positions" ("device_id", "recorded_at", "received_at", "id");
CREATE INDEX "track_positions_device_id_received_at_idx" ON "track_positions" ("device_id", "received_at");
