-- Reverses 20261009000000_must_change_password. Nothing else depends on these columns.
ALTER TABLE "Staff" DROP COLUMN "mustChangePassword";
ALTER TABLE "Member" DROP COLUMN "mustChangePassword";
