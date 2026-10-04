-- Rollback for 20261006000000_review_fixes. Run manually with psql, then
-- delete this migration's row from "_prisma_migrations".
-- Cancelled classes are kept as rows; after rollback they would show as
-- normal classes again, so they are deleted here (their bookings were
-- already removed when they were cancelled).
DELETE FROM "Class" WHERE "cancelledAt" IS NOT NULL;
DROP INDEX IF EXISTS "AuditLog_targetType_targetId_idx";
DROP INDEX IF EXISTS "AuditLog_staffId_idx";
DROP INDEX IF EXISTS "BenefitLedger_memberId_kind_effectiveAt_idx";
DROP INDEX IF EXISTS "ClassWaitlist_memberId_idx";
DROP INDEX IF EXISTS "Member_referredById_idx";
DROP INDEX IF EXISTS "Order_paidAt_idx";
DROP INDEX IF EXISTS "OrderItem_orderId_idx";
DROP INDEX IF EXISTS "Payout_paidAt_idx";
DROP INDEX IF EXISTS "Refund_paymentId_idx";
ALTER TABLE "BenefitLedger" DROP COLUMN IF EXISTS "effectiveAt";
ALTER TABLE "Class" DROP COLUMN IF EXISTS "cancelledAt";
ALTER TABLE "Member" DROP COLUMN IF EXISTS "membershipStartedAt", DROP COLUMN IF EXISTS "stripeEventAt";
-- paidAt is financial data: keep a copy before dropping the column.
CREATE TABLE IF NOT EXISTS "_archived_payout_paid_at" AS SELECT "id", "paidAt" FROM "Payout";
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "paidAt";
