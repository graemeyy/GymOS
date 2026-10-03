-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('WEEK', 'FORTNIGHT', 'MONTH', 'YEAR');

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'TRAINER';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "description" TEXT,
ADD COLUMN     "gstCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeInvoiceId" TEXT,
ALTER COLUMN "currency" SET DEFAULT 'aud';

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "stripePriceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlan_slug_key" ON "MembershipPlan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlan_stripePriceId_key" ON "MembershipPlan"("stripePriceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CheckIn_memberId_timestamp_idx" ON "CheckIn"("memberId", "timestamp");

-- CreateIndex
CREATE INDEX "CheckIn_timestamp_idx" ON "CheckIn"("timestamp");

-- CreateIndex
CREATE INDEX "Class_startTime_idx" ON "Class"("startTime");

-- CreateIndex
CREATE INDEX "ClassBooking_memberId_idx" ON "ClassBooking"("memberId");

-- CreateIndex
CREATE INDEX "Member_status_idx" ON "Member"("status");

-- CreateIndex
CREATE INDEX "Member_planId_idx" ON "Member"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_stripeInvoiceId_key" ON "Payout"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Payout_createdAt_idx" ON "Payout"("createdAt");

-- CreateIndex
CREATE INDEX "Payout_memberId_createdAt_idx" ON "Payout"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "Shift_startTime_idx" ON "Shift"("startTime");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill for existing installs only: turn the four legacy enum plans into
-- MembershipPlan rows (keeping any price the owner already set in PlanPrice)
-- and point members at them. A fresh database gets its plans from
-- config/gym.config.json instead. Prices are GST-inclusive AUD from here on.
INSERT INTO "MembershipPlan" ("id", "slug", "name", "priceCents", "interval", "sortOrder", "updatedAt")
SELECT 'legacy_' || lower(p.plan::text),
       lower(p.plan::text),
       initcap(lower(p.plan::text)),
       COALESCE(pp."priceCents", p.default_cents),
       'MONTH',
       p.sort_order,
       CURRENT_TIMESTAMP
FROM (VALUES ('BASIC'::"Plan", 2900, 1), ('PREMIUM'::"Plan", 4900, 2), ('PLATINUM'::"Plan", 9900, 3), ('ELITE'::"Plan", 19900, 4))
     AS p(plan, default_cents, sort_order)
LEFT JOIN "PlanPrice" pp ON pp."plan" = p.plan
WHERE EXISTS (SELECT 1 FROM "Member")
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Member" SET "planId" = 'legacy_' || lower("plan"::text)
WHERE "planId" IS NULL AND EXISTS (SELECT 1 FROM "MembershipPlan" WHERE "id" = 'legacy_' || lower("Member"."plan"::text));
