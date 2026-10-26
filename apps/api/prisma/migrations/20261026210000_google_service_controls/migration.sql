ALTER TABLE "google_connections" ADD COLUMN "disabled_services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
