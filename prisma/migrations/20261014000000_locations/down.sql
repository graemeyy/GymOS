-- Reverses 20261014000000_locations. Everything returns to one site.
-- Lost: locations other than "main" and everything recorded against them as
-- a location (rows themselves stay), plans' location access, staff location
-- limits, and stock held at other locations (it is added to the one count).
UPDATE "ProductVariant" pv SET "stockQty" = COALESCE((SELECT SUM(vs."quantity") FROM "VariantStock" vs WHERE vs."variantId" = pv."id"), pv."stockQty");

ALTER TABLE "Payout" DROP CONSTRAINT "Payout_locationId_fkey";
DROP INDEX "Payout_locationId_paidAt_idx";
ALTER TABLE "Payout" DROP COLUMN "locationId";
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_locationId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT "Order_locationId_fkey";
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_locationId_fkey";
ALTER TABLE "ClassTemplate" DROP CONSTRAINT "ClassTemplate_locationId_fkey";
ALTER TABLE "Class" DROP CONSTRAINT "Class_locationId_fkey";
ALTER TABLE "CheckIn" DROP CONSTRAINT "CheckIn_locationId_fkey";
ALTER TABLE "Member" DROP CONSTRAINT "Member_homeLocationId_fkey";

DROP TABLE "VariantStock";
DROP TABLE "StaffLocation";
DROP TABLE "PlanLocation";

DROP INDEX "Shift_locationId_startTime_idx";
DROP INDEX "Order_locationId_status_idx";
DROP INDEX "Class_locationId_startTime_idx";
DROP INDEX "CheckIn_locationId_timestamp_idx";

ALTER TABLE "Announcement" DROP COLUMN "locationId";
ALTER TABLE "CheckIn" DROP COLUMN "locationId";
ALTER TABLE "Class" DROP COLUMN "locationId";
ALTER TABLE "ClassTemplate" DROP COLUMN "locationId";
ALTER TABLE "Member" DROP COLUMN "homeLocationId";
ALTER TABLE "MembershipPlan" DROP COLUMN "locationAccess";
ALTER TABLE "Order" DROP COLUMN "locationId";
ALTER TABLE "Shift" DROP COLUMN "locationId";

DROP TABLE "Location";
DROP TYPE "LocationAccess";
