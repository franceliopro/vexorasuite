-- Catalogo de planos/pacotes (administracao Vexora).
CREATE TABLE "plans" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"        TEXT NOT NULL UNIQUE,
  "kind"        TEXT NOT NULL DEFAULT 'PLAN',
  "name"        TEXT NOT NULL,
  "tagline"     TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "audience"    TEXT NOT NULL DEFAULT '',
  "price_cents" INTEGER NOT NULL DEFAULT 0,
  "currency"    TEXT NOT NULL DEFAULT 'BRL',
  "cycle"       TEXT NOT NULL DEFAULT 'MONTH',
  "limits"      JSONB NOT NULL DEFAULT '{}',
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "is_public"   BOOLEAN NOT NULL DEFAULT true,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

ALTER TABLE "tenants" ADD COLUMN "plan_id" UUID REFERENCES "plans"("id") ON DELETE SET NULL;
ALTER TABLE "tenants" ADD COLUMN "entitlements" JSONB NOT NULL DEFAULT '{}';

-- Vexora Sites: site, paginas, blocos, formularios e conteudo dinamico (posts/imoveis).
CREATE TABLE "sites" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"     UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "slug"          TEXT NOT NULL UNIQUE,
  "kind"          TEXT NOT NULL DEFAULT 'DYNAMIC',
  "business_area" TEXT NOT NULL DEFAULT '',
  "name"          TEXT NOT NULL,
  "logo_url"      TEXT,
  "primary_color" TEXT NOT NULL DEFAULT '#0E7A5C',
  "accent_color"  TEXT NOT NULL DEFAULT '#6258DF',
  "departments"   JSONB NOT NULL DEFAULT '[]',
  "domain"        TEXT UNIQUE,
  "domain_status" TEXT NOT NULL DEFAULT 'NONE',
  "domain_token"  TEXT,
  "published"     BOOLEAN NOT NULL DEFAULT false,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX "sites_tenant_idx" ON "sites"("tenant_id");

CREATE TABLE "site_pages" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "site_id"    UUID NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "kind"       TEXT NOT NULL DEFAULT 'CUSTOM',
  "slug"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "hidden"     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("site_id", "slug")
);

CREATE TABLE "site_blocks" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "page_id"    UUID NOT NULL REFERENCES "site_pages"("id") ON DELETE CASCADE,
  "type"       TEXT NOT NULL,
  "content"    JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "hidden"     BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "site_blocks_page_idx" ON "site_blocks"("page_id", "sort_order");

CREATE TABLE "site_forms" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "site_id"    UUID NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "fields"     JSONB NOT NULL DEFAULT '[]',
  "targets"    JSONB NOT NULL DEFAULT '[]',
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE "site_form_submissions" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "form_id"    UUID NOT NULL REFERENCES "site_forms"("id") ON DELETE CASCADE,
  "site_id"    UUID NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "page_slug"  TEXT NOT NULL DEFAULT '',
  "values"     JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX "site_sub_form_idx" ON "site_form_submissions"("form_id", "created_at");

CREATE TABLE "site_items" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "site_id"      UUID NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "kind"         TEXT NOT NULL,
  "slug"         TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "excerpt"      TEXT,
  "cover_url"    TEXT,
  "data"         JSONB NOT NULL DEFAULT '{}',
  "sort_order"   INTEGER NOT NULL DEFAULT 0,
  "published"    BOOLEAN NOT NULL DEFAULT true,
  "published_at" TIMESTAMPTZ(6),
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE ("site_id", "kind", "slug")
);

-- Conexoes instancia (WhatsApp/redes sociais) NAO ligadas por padrao.
CREATE TABLE "channel_attachments" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_connection_id" UUID NOT NULL REFERENCES "channel_connections"("id") ON DELETE CASCADE,
  "service"               TEXT NOT NULL,
  "attached"              BOOLEAN NOT NULL DEFAULT false,
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE ("channel_connection_id", "service")
);

-- Estado atual preservado: canais existentes ja atendem; demais consumidores comecam desligados.
INSERT INTO "channel_attachments" ("channel_connection_id", "service", "attached")
SELECT id, 'INBOX', true FROM "channel_connections";

-- Catalogo inicial (precos e regras editaveis no painel).
INSERT INTO "plans" ("code","kind","name","tagline","description","audience","price_cents","cycle","limits","is_public","sort_order") VALUES
('sites','PLAN','So Sites','Site em ate 24h com IA','Site completo para a empresa: IA monta o template responsivo com as cores, logo e dados da empresa; paginas, formularios de contato e captura de leads com pre-cadastro; area de clientes para editar tudo.','Clinicas, advocacia, imobiliarias, escolas e e-commerce',14900,'MONTH','{"attendants":0,"bots":0,"ia":30,"iaTier":"basic","sites":1,"dynamic":true,"forms":true,"socialAccounts":3,"whatsapp":true,"crm":false,"finance":false,"followups":false,"marketingPublishing":false,"modules":["SITES"]}',true,10),
('robo','PLAN','So Robo','Chatbot com IA e tela cheia','Um robo atendendo sozinho: fluxo completo com IA, pagina publica /p/<token> e bot.vexorasuite.com.br, publicacao com revisoes imutaveis.','Empresas que vivem no WhatsApp ou Instagram',9900,'MONTH','{"attendants":0,"bots":1,"ia":100,"iaTier":"basic","sites":0,"socialAccounts":1,"whatsapp":true,"crm":false,"finance":false,"followups":false,"marketingPublishing":false,"modules":["AUTOMATION","CHANNELS"]}',true,20),
('atendimento','PLAN','Atendimento Multiagentes','Times atendendo juntos','Atendimento multiagentes com robo opcional: ate 5 atendentes, 1 robo com IA economica, WhatsApp e Instagram, pipeline no CRM, distribuicao por equipe.','Clinicas com recepcao, assistencias e lojas com time',34900,'MONTH','{"attendants":5,"bots":1,"ia":300,"iaTier":"eco","sites":0,"dynamic":false,"forms":false,"socialAccounts":2,"whatsapp":true,"crm":true,"finance":false,"followups":true,"marketingPublishing":false,"modules":["INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS"]}',true,30),
('atendimento_pro','PLAN','Atendimento Pro','Operacao completa de atendimento','Ate 15 atendentes, ate 2 robos com IA padrao, CRM completo, pipeline por equipe, Agenda, Tarefas, relatorios e integracao financeira Asaas.','Empresas consolidadas e operacoes 24/7',54900,'MONTH','{"attendants":15,"bots":2,"ia":800,"iaTier":"standard","sites":0,"dynamic":false,"forms":false,"socialAccounts":4,"whatsapp":true,"crm":true,"finance":true,"followups":true,"marketingPublishing":false,"modules":["INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE"]}',true,40),
('marketing','PLAN','Marketing Social','Publique todo dia sem virar escravo','Publicacao automatica nas redes com aprovacao pelo WhatsApp; ate 4 redes (Instagram, Facebook, LinkedIn, TikTok); IA de criacao de legenda e arte; fila inteligente.','Negocios e criadores que querem presenca diaria',24900,'MONTH','{"attendants":0,"bots":0,"ia":300,"iaTier":"standard","sites":0,"socialAccounts":4,"whatsapp":true,"crm":false,"finance":false,"followups":false,"marketingPublishing":true,"modules":["MARKETING","CHANNELS"]}',true,50),
('sites_atendimento','PLAN','Sites + Atendimento','Site, leads e time vendendo','Site completo com IA + atendimento multiagentes: 1 site, 5 atendentes, 1 robo, CRM e formularios que ja nascem como leads com origem e historico.','Clinicas, escolas e advogados com time',44900,'MONTH','{"attendants":5,"bots":1,"ia":500,"iaTier":"standard","sites":1,"dynamic":true,"forms":true,"socialAccounts":4,"whatsapp":true,"crm":true,"finance":false,"followups":true,"marketingPublishing":false,"modules":["SITES","INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS"]}',true,60),
('completo','PLAN','Vexora Completa','Tudo, sem limites de produto','Vexora completa para operacoes exigentes: sites ilimitados, ate 30 atendentes, 4 robos com IA padrao, Marketing completo, Financeiro e Seguimento.','Empresas em crescimento e redes com varias unidades',79900,'MONTH','{"attendants":30,"bots":4,"ia":2000,"iaTier":"standard","sites":10,"dynamic":true,"forms":true,"socialAccounts":10,"whatsapp":true,"crm":true,"finance":true,"followups":true,"marketingPublishing":true,"modules":["SITES","INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE","MARKETING","SETTINGS"]}',true,70),
('agencia','PACKAGE','Agencia (pacote)','Tres sites e dois robos no bolso','Pacote para agencias e parceiros: 3 sites, 2 robos, 10 atendentes, Marketing completo, Financeiro e Repasse de margem mensal.','Agencias, franquias e parceiros credenciados',149900,'MONTH','{"attendants":10,"bots":2,"ia":1500,"iaTier":"standard","sites":3,"dynamic":true,"forms":true,"socialAccounts":8,"whatsapp":true,"crm":true,"finance":true,"followups":true,"marketingPublishing":true,"modules":["SITES","INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE","MARKETING","SETTINGS"]}',true,80);
