-- Rollback for 20261005000000_phase3_member_features. Run manually with psql,
-- then delete this migration's row from "_prisma_migrations".
-- Members still PENDING (signed up, never started a plan) become CANCELED,
-- because the old status type has no PENDING value.
DROP TABLE IF EXISTS "LegalAcceptance";
DROP TYPE IF EXISTS "LegalDocument";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "confirmationSentAt";
ALTER TABLE "Member" DROP COLUMN IF EXISTS "anonymisedAt", DROP COLUMN IF EXISTS "notifyWaitlist", DROP COLUMN IF EXISTS "onboardedAt";

UPDATE "Member" SET "status" = 'CANCELED' WHERE "status" = 'PENDING';
ALTER TYPE "Status" RENAME TO "Status_old";
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELED', 'PAST_DUE');
ALTER TABLE "Member" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Member" ALTER COLUMN "status" TYPE "Status" USING ("status"::text::"Status");
ALTER TABLE "Member" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "Status_old";
