CREATE TABLE "scheduler_leases" (
  "name" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "lease_until" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "scheduler_leases_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "scheduler_leases_expiry_idx" ON "scheduler_leases" ("lease_until");
