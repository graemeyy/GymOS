-- R-34, D-119: short-lived check-in passes can each be used once.
ALTER TABLE "Member" ADD COLUMN "passUsedIssuedAt" TIMESTAMP(3);
