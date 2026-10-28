CREATE TABLE "home_presentations" (
 "tenant_id" UUID NOT NULL,
 "desktop_image" BYTEA,
 "desktop_color" TEXT,
 "desktop_mode" TEXT NOT NULL DEFAULT 'center',
 "mobile_image" BYTEA,
 "mobile_color" TEXT,
 "mobile_mode" TEXT NOT NULL DEFAULT 'center',
 "revision" INTEGER NOT NULL DEFAULT 0,
 "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "home_presentations_pkey" PRIMARY KEY ("tenant_id"),
 CONSTRAINT "home_presentations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "home_presentations_desktop_color_check" CHECK ("desktop_color" IS NULL OR "desktop_color" ~ '^#[0-9a-fA-F]{6}$'),
 CONSTRAINT "home_presentations_mobile_color_check" CHECK ("mobile_color" IS NULL OR "mobile_color" ~ '^#[0-9a-fA-F]{6}$'),
 CONSTRAINT "home_presentations_desktop_mode_check" CHECK ("desktop_mode" IN ('contain','cover','center','stretch','zoom','tile')),
 CONSTRAINT "home_presentations_mobile_mode_check" CHECK ("mobile_mode" IN ('contain','cover','center','stretch','zoom','tile'))
);
