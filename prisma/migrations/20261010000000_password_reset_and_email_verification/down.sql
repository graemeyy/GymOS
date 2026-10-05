-- Reverses 20261010000000_password_reset_and_email_verification. Outstanding
-- reset and verification links stop working; nothing else depends on them.
DROP TABLE "AuthToken";
DROP TYPE "AuthTokenPurpose";
ALTER TABLE "Member" DROP COLUMN "emailVerifiedAt";
