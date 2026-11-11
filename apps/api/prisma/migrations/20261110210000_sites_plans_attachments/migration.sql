-- Catálogo de planos/pacotes (administração Véxora).
CREATE TABLE "plans" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"        TEXT NOT NULL UNIQUE,
  "kind"        TEXT NOT NULL DEFAULT 'PLAN', -- PLAN | PACKAGE
  "name"        TEXT NOT NULL,
  "tagline"     TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "audience"    TEXT NOT NULL DEFAULT '',
  "price_cents" INTEGER NOT NULL DEFAULT 0,
  "currency"    TEXT NOT NULL DEFAULT 'BRL',
  "cycle"       TEXT NOT NULL DEFAULT 'MONTH', -- MONTH | YEAR | ONCE
  "limits"      JSONB NOT NULL DEFAULT '{}',
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "is_public"   BOOLEAN NOT NULL DEFAULT true,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Plano colecionado pela empresa na contratação/atualização (snapshot nos entitlements).
ALTER TABLE "tenants" ADD COLUMN "plan_id" UUID REFERENCES "plans"("id") ON DELETE SET NULL;
ALTER TABLE "tenants" ADD COLUMN "entitlements" JSONB NOT NULL DEFAULT '{}';

-- Véxora Sites: site, páginas, blocos, formulários e conteúdo dinâmico (posts/imóveis).
CREATE TABLE "sites" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"     UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "slug"          TEXT NOT NULL UNIQUE,
  "kind"          TEXT NOT NULL DEFAULT 'DYNAMIC', -- DYNAMIC | STATIC
  "business_area" TEXT NOT NULL DEFAULT '',
  "name"          TEXT NOT NULL,
  "logo_url"      TEXT,
  "primary_color" TEXT NOT NULL DEFAULT '#0E7A5C',
  "accent_color"  TEXT NOT NULL DEFAULT '#6258DF',
  "departments"   JSONB NOT NULL DEFAULT '[]', -- [{platform,label,url,handle}]
  "domain"        TEXT UNIQUE,
  "domain_status" TEXT NOT NULL DEFAULT 'NONE', -- NONE | PENDING_DNS | ACTIVE
  "domain_token"  TEXT,
  "published"     BOOLEAN NOT NULL DEFAULT false,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX "sites_tenant_idx" ON "sites"("tenant_id");

CREATE TABLE "site_pages" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "site_id"    UUID NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
  "kind"       TEXT NOT NULL DEFAULT 'CUSTOM', -- HOME | SERVICES | TEAM | IMOVEIS | POSTS | CONTACT | LANDING | CUSTOM
  "slug"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "hidden"     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("site_id", "slug")
);

CREATE TABLE "site_blocks" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "page_id"    UUID NOT NULL REFERENCES "site_pages"("id") ON DELETE CASCADE,
  "type"       TEXT NOT NULL, -- hero | richText | services | gallery | testimonials | faq | cta | posts | properties | contact | spacer
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
  "targets"    JSONB NOT NULL DEFAULT '[]', -- [{kind:'email',to}|{kind:'precadastro'}|{kind:'whatsapp',to}]
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
  "kind"         TEXT NOT NULL, -- post | property
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

-- Conexões-instância (WhatsApp/redes sociais) NÃO ligadas por padrão; ligadas por conexão a quem consome o evento.
CREATE TABLE "channel_attachments" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_connection_id" UUID NOT NULL REFERENCES "channel_connections"("id") ON DELETE CASCADE,
  "service"               TEXT NOT NULL, -- INBOX | IA | CHATBOT | SITE
  "attached"              BOOLEAN NOT NULL DEFAULT false,
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE ("channel_connection_id", "service")
);

-- Estado atual preservado: canais existentes já servem Atendimento; demais consumers começam desligados.
INSERT INTO "channel_attachments" ("channel_connection_id", "service", "attached")
SELECT id, 'INBOX', true FROM "channel_connections";

-- Catálogo inicial (preços e regras de exemplo, editáveis no painel).
INSERT INTO "plans" ("code","kind","name","tagline","description","audience","price_cents","cycle","limits","is_public","sort_order") VALUES
('sites','PLAN','Só Sites','Site em até 24h com IA','Site completo para a empresa: IA monta o template responsivo com as cores, logo e dados da empresa; páginas, formulários de contato e captura de leads com pré-cadastro; área de clientes para editar tudo.','Clínicas, advocacia, imobiliárias, escolas e e-commerce',14900,'MONTH','{"attendants":0,"bots":0,"ia":30,"iaTier":"basic","sites":1,"dynamic":true,"forms":true,"socialAccounts":3,"whatsapp":true,"crm":false,"finance":false,"followups":false,"marketingPublishing":false,"modules":["SITES"]}',true,10),
('robo','PLAN','Só Robô','Chatbot com IA e tela cheia','Um robô atendendo sozinho: fluxo completo com IA, página pública /p/<token> e bot.vexorasuite.com.br, publicação com revisões imutáveis.','Empresas que vivem no WhatsApp ou Instagram',9900,'MONTH','{"attendants":0,"bots":1,"ia":100,"iaTier":"basic","sites":0,"socialAccounts":1,"whatsapp":true,"crm":false,"finance":false,"followups":false,"marketingPublishing":false,"modules":["AUTOMATION","CHANNELS"]}',true,20),
('atendimento','PLAN','Atendimento Multiagentes','Times atendendo juntos','Atendimento multiagentes com robô opcional: até 5 atendentes, 1 robô com IA econômica, WhatsApp e Instagram, pipeline no CRM, distribuição por equipe.','Clínicas com recepção, assistências e lojas com time',34900,'MONTH','{"attendants":5,"bots":1,"ia":300,"iaTier":"eco","sites":0,"dynamic":false,"forms":false,"socialAccounts":2,"whatsapp":true,"crm":true,"finance":false,"followups":true,"marketingPublishing":false,"modules":["INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS"]}',true,30),
('atendimento_pro','PLAN','Atendimento Pro','Operação completa de atendimento','Até 15 atendentes, até 2 robôs com IA padrão, CRM completo, pipeline por equipe, Agenda, Tarefas, relatórios e integração financeira Asaas.','Empresas consolidadas e operações 24/7',54900,'MONTH','{"attendants":15,"bots":2,"ia":800,"iaTier":"standard","sites":0,"dynamic":false,"forms":false,"socialAccounts":4,"whatsapp":true,"crm":true,"finance":true,"followups":true,"marketingPublishing":false,"modules":["INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE"]}',true,40),
('marketing','PLAN','Marketing Social','Publique todo dia sem virar escravo','Publicação automática nas redes com aprovação pelo WhatsApp; até 4 redes (Instagram, Facebook, LinkedIn, TikTok); IA de criação de legenda e arte; fila inteligente.','Negócios e criadores que querem presença diária',24900,'MONTH','{"attendants":0,"bots":0,"ia":300,"iaTier":"standard","sites":0,"socialAccounts":4,"whatsapp":true,"crm":false,"finance":false,"followups":false,"marketingPublishing":true,"modules":["MARKETING","CHANNELS"]}',true,50),
('sites_atendimento','PLAN','Sites + Atendimento','Site, leads e time vendendo','Site completo com IA + atendimento multiagentes: 1 site, 5 atendentes, 1 robô, CRM e formulários que já nascem como leads com origem e histórico.','Clínicas, escolas e advogados com time',44900,'MONTH','{"attendants":5,"bots":1,"ia":500,"iaTier":"standard","sites":1,"dynamic":true,"forms":true,"socialAccounts":4,"whatsapp":true,"crm":true,"finance":false,"followups":true,"marketingPublishing":false,"modules":["SITES","INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS"]}',true,60),
('completo','PLAN','Véxora Completa','Tudo, sem limites de produto','Véxora completa para operações exigentes: sites ilimitados, até 30 atendentes, 4 robôs com IA padrão, Marketing completo, Financeiro e Seguimento.','Empresas em crescimento e redes com várias unidades',79900,'MONTH','{"attendants":30,"bots":4,"ia":2000,"iaTier":"standard","sites":10,"dynamic":true,"forms":true,"socialAccounts":10,"whatsapp":true,"crm":true,"finance":true,"followups":true,"marketingPublishing":true,"modules":["SITES","INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE","MARKETING","SETTINGS"]}',true,70),
('agencia','PACKAGE','Agência (pacote)','Três sites e dois robôs no bolso','Pacote para agências e parceiros: 3 sites, 2 robôs, 10 atendentes, Marketing completo, Financeiro e Repasse de margem mensal.','Agências, franquias e parceiros credenciados',149900,'MONTH','{"attendants":10,"bots":2,"ia":1500,"iaTier":"standard","sites":3,"dynamic":true,"forms":true,"socialAccounts":8,"whatsapp":true,"crm":true,"finance":true,"followups":true,"marketingPublishing":true,"modules":["SITES","INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE","MARKETING","SETTINGS"]}',true,80);
