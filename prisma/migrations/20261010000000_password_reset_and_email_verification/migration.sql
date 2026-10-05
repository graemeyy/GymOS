-- D-112, D-113, D-114: password reset and email verification tokens, and when a member verified their email.
-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "staffId" TEXT,
    "memberId" TEXT,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_staffId_purpose_idx" ON "AuthToken"("staffId", "purpose");

-- CreateIndex
CREATE INDEX "AuthToken_memberId_purpose_idx" ON "AuthToken"("memberId", "purpose");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one of staffId and memberId.
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_one_owner" CHECK (("staffId" IS NULL) <> ("memberId" IS NULL));

-- Members who exist before this migration aren't asked to verify (D-114):
-- staff added them in person, or they signed up before verification existed.
UPDATE "Member" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
