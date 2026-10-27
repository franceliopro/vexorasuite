
ALTER TABLE users ADD COLUMN avatar_url TEXT, ADD COLUMN avatar_source TEXT, ADD COLUMN avatar_checked_at TIMESTAMP(3);
CREATE TABLE publication_folders (
 id UUID PRIMARY KEY,tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,user_id UUID NOT NULL REFERENCES users(id),account_id UUID NOT NULL REFERENCES google_connections(id) ON DELETE CASCADE,
 folder_id TEXT NOT NULL,published_folder_id TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('READY','NEWS')),channel_ids UUID[] NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT false,every_days INTEGER NOT NULL DEFAULT 1 CHECK(every_days BETWEEN 1 AND 30),next_publish_at TIMESTAMP(3) NOT NULL,next_scan_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 remaining INTEGER NOT NULL DEFAULT 0,last_scan_at TIMESTAMP(3),last_error TEXT,created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP(3) NOT NULL,
 UNIQUE(tenant_id,account_id,folder_id));
CREATE INDEX publication_folders_due ON publication_folders(enabled,next_scan_at);
CREATE TABLE prepared_publications (
 id UUID PRIMARY KEY,tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,user_id UUID NOT NULL REFERENCES users(id),account_id UUID REFERENCES google_connections(id) ON DELETE SET NULL,file_id TEXT,rule_id UUID REFERENCES publication_folders(id) ON DELETE SET NULL,
 name TEXT NOT NULL,type TEXT NOT NULL,caption TEXT NOT NULL DEFAULT '',model TEXT,status TEXT NOT NULL DEFAULT 'QUEUED',post_id TEXT,channel_ids UUID[] NOT NULL,result JSONB NOT NULL DEFAULT '{}',error TEXT,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP(3) NOT NULL,UNIQUE(tenant_id,account_id,file_id),UNIQUE(tenant_id,file_id));
CREATE INDEX prepared_publications_status ON prepared_publications(status,updated_at);
