-- Reverses 20261012000000_short_lived_passes. Passes still expire after 90
-- seconds without it, but a code could be used twice within that time.
ALTER TABLE "Member" DROP COLUMN "passUsedIssuedAt";
