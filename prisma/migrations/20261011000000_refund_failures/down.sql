-- Reverses 20261011000000_refund_failures. A refund marked failed would count
-- again in finance reports after this; check none are marked first:
--   SELECT count(*) FROM "Refund" WHERE "failedAt" IS NOT NULL;
ALTER TABLE "Refund" DROP COLUMN "failureReason";
ALTER TABLE "Refund" DROP COLUMN "failedAt";
