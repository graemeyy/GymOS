-- Rolls back 20261008000000_roles_and_permissions. Staff keep their legacy
-- fixed role, which the migration never changed. Invited staff who never set
-- a password can't keep a null password hash under the old schema, so they
-- are removed; their invitations would have to be sent again.
DELETE FROM "Staff" WHERE "passwordHash" IS NULL;

ALTER TABLE "Staff" DROP CONSTRAINT IF EXISTS "Staff_roleId_fkey";
DROP INDEX IF EXISTS "Staff_roleId_idx";
DROP INDEX IF EXISTS "Staff_inviteTokenHash_key";
DROP INDEX IF EXISTS "AuditLog_action_idx";
ALTER TABLE "Staff" DROP COLUMN IF EXISTS "roleId", DROP COLUMN IF EXISTS "deactivatedAt",
  DROP COLUMN IF EXISTS "inviteTokenHash", DROP COLUMN IF EXISTS "inviteExpiresAt";
ALTER TABLE "Staff" ALTER COLUMN "passwordHash" SET NOT NULL;

-- Old and new values in the audit log are kept as JSON in an archive table.
CREATE TABLE IF NOT EXISTS "_archived_audit_values" AS
  SELECT "id", "before", "after" FROM "AuditLog" WHERE "before" IS NOT NULL OR "after" IS NOT NULL;
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "before", DROP COLUMN IF EXISTS "after";

CREATE TABLE IF NOT EXISTS "_archived_roles" AS SELECT to_jsonb(r) AS "row" FROM "Role" r;
DROP TABLE IF EXISTS "Role";
