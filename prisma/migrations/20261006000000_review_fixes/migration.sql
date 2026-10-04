-- Review fixes (docs/REVIEW.md). Additive only; see down.sql to roll back.
-- AlterTable
ALTER TABLE "BenefitLedger" ADD COLUMN     "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "membershipStartedAt" TIMESTAMP(3),
ADD COLUMN     "stripeEventAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_staffId_idx" ON "AuditLog"("staffId");

-- CreateIndex
CREATE INDEX "BenefitLedger_memberId_kind_effectiveAt_idx" ON "BenefitLedger"("memberId", "kind", "effectiveAt");

-- CreateIndex
CREATE INDEX "ClassWaitlist_memberId_idx" ON "ClassWaitlist"("memberId");

-- CreateIndex
CREATE INDEX "Member_referredById_idx" ON "Member"("referredById");

-- CreateIndex
CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Payout_paidAt_idx" ON "Payout"("paidAt");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");


-- Backfills
-- Class credits count towards the cycle of the class they were used for.
UPDATE "BenefitLedger" b SET "effectiveAt" = c."startTime"
  FROM "Class" c
  WHERE b."refType" IN ('booking', 'booking_refund') AND b."refId" = c."id";
UPDATE "BenefitLedger" SET "effectiveAt" = "createdAt"
  WHERE "refType" IS NULL OR "refType" NOT IN ('booking', 'booking_refund')
     OR NOT EXISTS (SELECT 1 FROM "Class" c WHERE c."id" = "BenefitLedger"."refId");
-- Existing payments: the best record of when they were paid is when they were recorded.
UPDATE "Payout" SET "paidAt" = "createdAt";
-- Existing memberships started when the member joined.
UPDATE "Member" SET "membershipStartedAt" = "createdAt" WHERE "status" <> 'PENDING';
