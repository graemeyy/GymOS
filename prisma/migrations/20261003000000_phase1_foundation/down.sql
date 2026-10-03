-- Rollback for 20261003000000_phase1_foundation. Run manually with psql, then
-- delete this migration's row from "_prisma_migrations".
-- Data written to the new columns and tables is lost; nothing that existed
-- before the migration is touched.
ALTER TABLE "Member" DROP CONSTRAINT IF EXISTS "Member_planId_fkey";
DROP INDEX IF EXISTS "Shift_startTime_idx";
DROP INDEX IF EXISTS "Payout_memberId_createdAt_idx";
DROP INDEX IF EXISTS "Payout_createdAt_idx";
DROP INDEX IF EXISTS "Payout_stripeInvoiceId_key";
DROP INDEX IF EXISTS "Member_planId_idx";
DROP INDEX IF EXISTS "Member_status_idx";
DROP INDEX IF EXISTS "ClassBooking_memberId_idx";
DROP INDEX IF EXISTS "Class_startTime_idx";
DROP INDEX IF EXISTS "CheckIn_timestamp_idx";
DROP INDEX IF EXISTS "CheckIn_memberId_timestamp_idx";
DROP INDEX IF EXISTS "AuditLog_createdAt_idx";
DROP TABLE IF EXISTS "RateLimit";
DROP TABLE IF EXISTS "StripeEvent";
DROP TABLE IF EXISTS "MembershipPlan";
ALTER TABLE "Staff" DROP COLUMN IF EXISTS "sessionVersion";
ALTER TABLE "Payout" ALTER COLUMN "currency" SET DEFAULT 'usd';
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "stripeInvoiceId", DROP COLUMN IF EXISTS "gstCents", DROP COLUMN IF EXISTS "description";
ALTER TABLE "Member" DROP COLUMN IF EXISTS "sessionVersion", DROP COLUMN IF EXISTS "planId", DROP COLUMN IF EXISTS "passwordHash", DROP COLUMN IF EXISTS "archivedAt";
-- Postgres can't drop an enum value. Move any TRAINER staff to FRONT_DESK and
-- recreate the type without it.
UPDATE "Staff" SET "role" = 'FRONT_DESK' WHERE "role" = 'TRAINER';
ALTER TABLE "Staff" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "StaffRole" RENAME TO "StaffRole_old";
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'MANAGER', 'FRONT_DESK');
ALTER TABLE "Staff" ALTER COLUMN "role" TYPE "StaffRole" USING ("role"::text::"StaffRole");
ALTER TABLE "Staff" ALTER COLUMN "role" SET DEFAULT 'FRONT_DESK';
DROP TYPE "StaffRole_old";
DROP TYPE IF EXISTS "BillingInterval";
