CREATE TABLE marketing_jobs (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 user_id UUID NOT NULL, request_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'QUEUED',
 payload JSONB NOT NULL, result JSONB, error TEXT, run_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 started_at TIMESTAMP(3), completed_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX marketing_jobs_tenant_id_request_key_key ON marketing_jobs(tenant_id,request_key);
CREATE INDEX marketing_jobs_status_run_at_idx ON marketing_jobs(status,run_at);
CREATE INDEX marketing_jobs_tenant_id_created_at_idx ON marketing_jobs(tenant_id,created_at);
CREATE TABLE marketing_workflows (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 user_id UUID NOT NULL, name TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true,
 payload JSONB NOT NULL, every_days INTEGER NOT NULL DEFAULT 0,
 next_run_at TIMESTAMP(3) NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX marketing_workflows_enabled_next_run_at_idx ON marketing_workflows(enabled,next_run_at);
CREATE INDEX marketing_workflows_tenant_id_created_at_idx ON marketing_workflows(tenant_id,created_at);
