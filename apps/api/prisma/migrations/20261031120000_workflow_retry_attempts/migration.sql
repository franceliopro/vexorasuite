-- Track bounded retries for each workflow step.
ALTER TABLE "workflow_runs" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
