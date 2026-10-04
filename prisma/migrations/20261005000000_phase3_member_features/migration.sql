-- Phase 3: member self-service. Additive only; see down.sql to roll back.
-- CreateEnum
CREATE TYPE "LegalDocument" AS ENUM ('TERMS', 'PRIVACY');

-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "anonymisedAt" TIMESTAMP(3),
ADD COLUMN     "notifyWaitlist" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "document" "LegalDocument" NOT NULL,
    "version" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalAcceptance_memberId_document_acceptedAt_idx" ON "LegalAcceptance"("memberId", "document", "acceptedAt");

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing members joined before online onboarding existed.
UPDATE "Member" SET "onboardedAt" = "createdAt" WHERE "onboardedAt" IS NULL;
