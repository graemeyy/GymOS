-- D-111: accounts that must choose a new password before doing anything else.
-- Existing accounts are unaffected (false).
ALTER TABLE "Member" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Staff" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
