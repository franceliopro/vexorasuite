ALTER TABLE "tenants" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'COMPANY';
ALTER TABLE "users" ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "memberships" ADD COLUMN "denied_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- Only the unique existing workspace and its unique active owner can be adopted.
-- Ambiguous installations require the explicit bootstrap command; never guess an identity.
DO $$
DECLARE root_id UUID; owner_id UUID;
BEGIN
 IF (SELECT COUNT(*) FROM tenants)=1 AND
    (SELECT COUNT(*) FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.role='OWNER' AND u.is_active)=1 THEN
  SELECT id INTO root_id FROM tenants LIMIT 1;
  SELECT m.user_id INTO owner_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=root_id AND m.role='OWNER' AND u.is_active;
  UPDATE tenants SET kind='PLATFORM',name='Véxora Suite' WHERE id=root_id;
  UPDATE users SET is_platform_admin=true WHERE id=owner_id;
 END IF;
END $$;
CREATE UNIQUE INDEX "tenants_single_platform" ON "tenants" ("kind") WHERE "kind"='PLATFORM';
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_kind_check" CHECK ("kind" IN ('PLATFORM','COMPANY'));
