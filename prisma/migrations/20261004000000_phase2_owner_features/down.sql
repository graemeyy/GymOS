-- Rollback for 20261004000000_phase2_owner_features. Run manually with psql,
-- then delete this migration's row from "_prisma_migrations".
-- Removes Phase 2 tables and columns. Financial records (refunds, shop orders
-- and the invoice numbers and refund totals on payments) are tax records, so
-- they are first copied into _archived_* tables as JSON, which doesn't depend
-- on the types dropped below. Other Phase 2 data is lost. Member.notes was
-- never modified, so earlier notes survive.
CREATE TABLE IF NOT EXISTS "_archived_refund" AS SELECT to_jsonb(r) AS "row" FROM "Refund" r;
CREATE TABLE IF NOT EXISTS "_archived_order" AS SELECT to_jsonb(o) AS "row" FROM "Order" o;
CREATE TABLE IF NOT EXISTS "_archived_order_item" AS SELECT to_jsonb(i) AS "row" FROM "OrderItem" i;
CREATE TABLE IF NOT EXISTS "_archived_order_event" AS SELECT to_jsonb(e) AS "row" FROM "OrderEvent" e;
CREATE TABLE IF NOT EXISTS "_archived_payout_phase2" AS
  SELECT "id", "invoiceNumber", "kind"::text AS "kind", "orderId", "planName", "refundedCents", "stripePaymentIntentId" FROM "Payout";
DROP TABLE IF EXISTS "Announcement";
DROP TABLE IF EXISTS "OrderEvent";
DROP TABLE IF EXISTS "OrderItem";
ALTER TABLE "Payout" DROP CONSTRAINT IF EXISTS "Payout_orderId_fkey";
DROP TABLE IF EXISTS "Order";
DROP TABLE IF EXISTS "ProductVariant";
DROP TABLE IF EXISTS "Product";
ALTER TABLE "Class" DROP CONSTRAINT IF EXISTS "Class_templateId_fkey";
ALTER TABLE "Class" DROP CONSTRAINT IF EXISTS "Class_trainerId_fkey";
DROP TABLE IF EXISTS "ClassTemplate";
DROP TABLE IF EXISTS "Refund";
DROP TABLE IF EXISTS "PaymentReminder";
DROP TABLE IF EXISTS "MembershipEvent";
DROP TABLE IF EXISTS "BenefitLedger";
DROP TABLE IF EXISTS "MemberNote";
DROP INDEX IF EXISTS "Payout_orderId_key";
DROP INDEX IF EXISTS "Payout_invoiceNumber_key";
DROP INDEX IF EXISTS "Payout_stripePaymentIntentId_key";
DROP INDEX IF EXISTS "Member_cancelledAt_idx";
DROP INDEX IF EXISTS "Member_createdAt_idx";
DROP INDEX IF EXISTS "Class_templateId_startTime_key";
DROP INDEX IF EXISTS "Class_trainerId_startTime_idx";
ALTER TABLE "Member" DROP CONSTRAINT IF EXISTS "Member_pendingPlanId_fkey";
ALTER TABLE "Payout" DROP COLUMN IF EXISTS "invoiceNumber", DROP COLUMN IF EXISTS "kind", DROP COLUMN IF EXISTS "orderId",
  DROP COLUMN IF EXISTS "planName", DROP COLUMN IF EXISTS "refundedCents", DROP COLUMN IF EXISTS "stripePaymentIntentId";
ALTER TABLE "MembershipPlan" DROP COLUMN IF EXISTS "classCreditsPerCycle", DROP COLUMN IF EXISTS "guestPassesPerCycle",
  DROP COLUMN IF EXISTS "guestRateCents", DROP COLUMN IF EXISTS "shopDiscountPercent";
ALTER TABLE "Member" DROP COLUMN IF EXISTS "amountOwingCents", DROP COLUMN IF EXISTS "cancelAt", DROP COLUMN IF EXISTS "cancelReason",
  DROP COLUMN IF EXISTS "cancelledAt", DROP COLUMN IF EXISTS "currentPeriodEnd", DROP COLUMN IF EXISTS "currentPeriodStart",
  DROP COLUMN IF EXISTS "lastFailedInvoiceId", DROP COLUMN IF EXISTS "notifyAnnouncements", DROP COLUMN IF EXISTS "pastDueSince",
  DROP COLUMN IF EXISTS "pausedFrom", DROP COLUMN IF EXISTS "pausedUntil", DROP COLUMN IF EXISTS "pendingPlanId", DROP COLUMN IF EXISTS "qrVersion";
ALTER TABLE "ClassBooking" DROP COLUMN IF EXISTS "usedCredit";
ALTER TABLE "Class" DROP COLUMN IF EXISTS "templateId", DROP COLUMN IF EXISTS "trainerId";
ALTER TABLE "CheckIn" DROP COLUMN IF EXISTS "method";
DROP TYPE IF EXISTS "AnnouncementAudience";
DROP TYPE IF EXISTS "Fulfilment";
DROP TYPE IF EXISTS "OrderStatus";
DROP TYPE IF EXISTS "ProductCategory";
DROP TYPE IF EXISTS "PaymentKind";
DROP TYPE IF EXISTS "MembershipEventType";
DROP TYPE IF EXISTS "LedgerKind";
