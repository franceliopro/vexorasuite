ALTER TABLE "departments"
  ADD COLUMN "routing_strategy" TEXT NOT NULL DEFAULT 'ROUND_ROBIN',
  ADD COLUMN "max_open_conversations" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_max_open_conversations_nonnegative"
  CHECK ("max_open_conversations" >= 0);
