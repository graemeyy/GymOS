-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('CLASS_CREDIT', 'GUEST_PASS', 'ACCOUNT_CREDIT');

-- CreateEnum
CREATE TYPE "MembershipEventType" AS ENUM ('JOINED', 'PLAN_CHANGED', 'PLAN_CHANGE_SCHEDULED', 'PAUSE_SCHEDULED', 'RESUMED', 'CANCEL_REQUESTED', 'CANCEL_WITHDRAWN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('MEMBERSHIP', 'SHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('APPAREL', 'SUPPLEMENTS', 'ACCESSORIES', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PACKED', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "Fulfilment" AS ENUM ('PICKUP', 'SHIPPING');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL_ACTIVE', 'PLAN', 'STAFF_ONLY');

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "trainerId" TEXT;

-- AlterTable
ALTER TABLE "ClassBooking" ADD COLUMN     "usedCredit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "amountOwingCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cancelAt" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "lastFailedInvoiceId" TEXT,
ADD COLUMN     "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pastDueSince" TIMESTAMP(3),
ADD COLUMN     "pausedFrom" TIMESTAMP(3),
ADD COLUMN     "pausedUntil" TIMESTAMP(3),
ADD COLUMN     "pendingPlanId" TEXT,
ADD COLUMN     "qrVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "classCreditsPerCycle" INTEGER,
ADD COLUMN     "guestPassesPerCycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "guestRateCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shopDiscountPercent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "invoiceNumber" SERIAL NOT NULL,
ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'MEMBERSHIP',
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "planName" TEXT,
ADD COLUMN     "refundedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripePaymentIntentId" TEXT;

-- CreateTable
CREATE TABLE "MemberNote" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "staffId" TEXT,
    "staffName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenefitLedger" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenefitLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipEvent" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "MembershipEventType" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "pastDueSince" TIMESTAMP(3) NOT NULL,
    "day" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "gstCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "stripeRefundId" TEXT,
    "method" TEXT NOT NULL DEFAULT 'STRIPE',
    "staffId" TEXT,
    "staffName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trainerId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 45,
    "capacity" INTEGER NOT NULL DEFAULT 16,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProductCategory" NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "colour" TEXT,
    "flavour" TEXT,
    "sku" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "memberId" TEXT,
    "email" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "fulfilment" "Fulfilment" NOT NULL DEFAULT 'PICKUP',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "gstCents" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "shippingAddress" JSONB,
    "trackingNumber" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stockCommitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotalCents" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL_ACTIVE',
    "planId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberNote_memberId_createdAt_idx" ON "MemberNote"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "BenefitLedger_memberId_kind_createdAt_idx" ON "BenefitLedger"("memberId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "MembershipEvent_memberId_createdAt_idx" ON "MembershipEvent"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "MembershipEvent_type_effectiveAt_idx" ON "MembershipEvent"("type", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReminder_memberId_pastDueSince_day_key" ON "PaymentReminder"("memberId", "pastDueSince", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_memberId_createdAt_idx" ON "Order"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_publishedAt_idx" ON "Announcement"("publishedAt");

-- CreateIndex
CREATE INDEX "Class_trainerId_startTime_idx" ON "Class"("trainerId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Class_templateId_startTime_key" ON "Class"("templateId", "startTime");

-- CreateIndex
CREATE INDEX "Member_createdAt_idx" ON "Member"("createdAt");

-- CreateIndex
CREATE INDEX "Member_cancelledAt_idx" ON "Member"("cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_stripePaymentIntentId_key" ON "Payout"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_invoiceNumber_key" ON "Payout"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_orderId_key" ON "Payout"("orderId");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_pendingPlanId_fkey" FOREIGN KEY ("pendingPlanId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberNote" ADD CONSTRAINT "MemberNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenefitLedger" ADD CONSTRAINT "BenefitLedger_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipEvent" ADD CONSTRAINT "MembershipEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClassTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: the single free-text note becomes the first entry in the note
-- history (the original column is left untouched).
INSERT INTO "MemberNote" ("id", "memberId", "staffName", "body", "createdAt")
SELECT 'imported_' || "id", "id", 'Imported from earlier notes', "notes", "updatedAt"
FROM "Member"
WHERE "notes" IS NOT NULL AND btrim("notes") <> '';

-- Members already past due start their reminder clock now.
UPDATE "Member" SET "pastDueSince" = CURRENT_TIMESTAMP WHERE "status" = 'PAST_DUE' AND "pastDueSince" IS NULL;
