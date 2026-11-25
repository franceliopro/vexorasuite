import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'agent', 'service');
  CREATE TYPE "public"."enum_property_status" AS ENUM('draft', 'pending', 'published', 'rejected');
  CREATE TYPE "public"."enum_submission_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'agent' NOT NULL,
  	"role_scope" varchar,
  	"tenant_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "category" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "purpose" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "location" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" varchar NOT NULL,
  	"city" varchar NOT NULL,
  	"state" varchar,
  	"region" varchar,
  	"neighborhood" varchar,
  	"natural_key" varchar NOT NULL,
  	"legacy_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "property" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" varchar NOT NULL,
  	"legacy_id" varchar,
  	"code" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"type" varchar,
  	"owner_id_id" integer,
  	"category_id" integer,
  	"purpose_id" integer,
  	"location_id" integer,
  	"price" numeric,
  	"condominium" numeric,
  	"bedrooms" numeric,
  	"bathrooms" numeric,
  	"parking" numeric,
  	"area" numeric,
  	"status" "enum_property_status" DEFAULT 'draft' NOT NULL,
  	"gallery" jsonb DEFAULT '[]'::jsonb,
  	"description" varchar,
  	"rejection_reason" varchar,
  	"legacy_updated_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "submission" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" varchar NOT NULL,
  	"legacy_id" varchar,
  	"submission_key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"payload" jsonb DEFAULT '{}'::jsonb,
  	"status" "enum_submission_status" DEFAULT 'pending' NOT NULL,
  	"rejection_reason" varchar,
  	"property_id_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"legacy_created_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" varchar NOT NULL,
  	"legacy_id" varchar NOT NULL,
  	"filename" varchar,
  	"url" varchar,
  	"alt" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"source" jsonb DEFAULT '{}'::jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"category_id" integer,
  	"purpose_id" integer,
  	"location_id" integer,
  	"property_id" integer,
  	"submission_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "property" ADD CONSTRAINT "property_owner_id_id_users_id_fk" FOREIGN KEY ("owner_id_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "property" ADD CONSTRAINT "property_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "property" ADD CONSTRAINT "property_purpose_id_purpose_id_fk" FOREIGN KEY ("purpose_id") REFERENCES "public"."purpose"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "property" ADD CONSTRAINT "property_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submission" ADD CONSTRAINT "submission_property_id_id_property_id_fk" FOREIGN KEY ("property_id_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_category_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_purpose_fk" FOREIGN KEY ("purpose_id") REFERENCES "public"."purpose"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_location_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_submission_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_tenant_id_idx" ON "users" USING btree ("tenant_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "category_tenant_id_idx" ON "category" USING btree ("tenant_id");
  CREATE INDEX "category_slug_idx" ON "category" USING btree ("slug");
  CREATE INDEX "category_legacy_id_idx" ON "category" USING btree ("legacy_id");
  CREATE INDEX "category_updated_at_idx" ON "category" USING btree ("updated_at");
  CREATE INDEX "category_created_at_idx" ON "category" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenantId_slug_idx" ON "category" USING btree ("tenant_id","slug");
  CREATE INDEX "purpose_tenant_id_idx" ON "purpose" USING btree ("tenant_id");
  CREATE INDEX "purpose_slug_idx" ON "purpose" USING btree ("slug");
  CREATE INDEX "purpose_legacy_id_idx" ON "purpose" USING btree ("legacy_id");
  CREATE INDEX "purpose_updated_at_idx" ON "purpose" USING btree ("updated_at");
  CREATE INDEX "purpose_created_at_idx" ON "purpose" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenantId_slug_1_idx" ON "purpose" USING btree ("tenant_id","slug");
  CREATE INDEX "location_tenant_id_idx" ON "location" USING btree ("tenant_id");
  CREATE INDEX "location_natural_key_idx" ON "location" USING btree ("natural_key");
  CREATE INDEX "location_legacy_id_idx" ON "location" USING btree ("legacy_id");
  CREATE INDEX "location_updated_at_idx" ON "location" USING btree ("updated_at");
  CREATE INDEX "location_created_at_idx" ON "location" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenantId_naturalKey_idx" ON "location" USING btree ("tenant_id","natural_key");
  CREATE INDEX "property_tenant_id_idx" ON "property" USING btree ("tenant_id");
  CREATE INDEX "property_legacy_id_idx" ON "property" USING btree ("legacy_id");
  CREATE INDEX "property_code_idx" ON "property" USING btree ("code");
  CREATE INDEX "property_owner_id_idx" ON "property" USING btree ("owner_id_id");
  CREATE INDEX "property_category_idx" ON "property" USING btree ("category_id");
  CREATE INDEX "property_purpose_idx" ON "property" USING btree ("purpose_id");
  CREATE INDEX "property_location_idx" ON "property" USING btree ("location_id");
  CREATE INDEX "property_status_idx" ON "property" USING btree ("status");
  CREATE INDEX "property_updated_at_idx" ON "property" USING btree ("updated_at");
  CREATE INDEX "property_created_at_idx" ON "property" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenantId_code_idx" ON "property" USING btree ("tenant_id","code");
  CREATE INDEX "submission_tenant_id_idx" ON "submission" USING btree ("tenant_id");
  CREATE INDEX "submission_legacy_id_idx" ON "submission" USING btree ("legacy_id");
  CREATE INDEX "submission_submission_key_idx" ON "submission" USING btree ("submission_key");
  CREATE INDEX "submission_status_idx" ON "submission" USING btree ("status");
  CREATE INDEX "submission_property_id_idx" ON "submission" USING btree ("property_id_id");
  CREATE INDEX "submission_updated_at_idx" ON "submission" USING btree ("updated_at");
  CREATE INDEX "submission_created_at_idx" ON "submission" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenantId_submission_key_idx" ON "submission" USING btree ("tenant_id","submission_key");
  CREATE INDEX "media_tenant_id_idx" ON "media" USING btree ("tenant_id");
  CREATE INDEX "media_legacy_id_idx" ON "media" USING btree ("legacy_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenantId_legacyId_idx" ON "media" USING btree ("tenant_id","legacy_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_category_id_idx" ON "payload_locked_documents_rels" USING btree ("category_id");
  CREATE INDEX "payload_locked_documents_rels_purpose_id_idx" ON "payload_locked_documents_rels" USING btree ("purpose_id");
  CREATE INDEX "payload_locked_documents_rels_location_id_idx" ON "payload_locked_documents_rels" USING btree ("location_id");
  CREATE INDEX "payload_locked_documents_rels_property_id_idx" ON "payload_locked_documents_rels" USING btree ("property_id");
  CREATE INDEX "payload_locked_documents_rels_submission_id_idx" ON "payload_locked_documents_rels" USING btree ("submission_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "category" CASCADE;
  DROP TABLE "purpose" CASCADE;
  DROP TABLE "location" CASCADE;
  DROP TABLE "property" CASCADE;
  DROP TABLE "submission" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_property_status";
  DROP TYPE "public"."enum_submission_status";`)
}
