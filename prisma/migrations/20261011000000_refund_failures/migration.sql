-- R-25, D-116: refunds that Stripe later reports as failed or cancelled.
ALTER TABLE "Refund" ADD COLUMN "failedAt" TIMESTAMP(3);
ALTER TABLE "Refund" ADD COLUMN "failureReason" TEXT;
