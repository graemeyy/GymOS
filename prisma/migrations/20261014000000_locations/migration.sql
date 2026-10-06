-- D-125 to D-128: multiple locations. Additive: a Location table with one
-- "main" location, a location on classes, timetable slots, shifts,
-- check-ins, orders and announcements, members' home location, which
-- locations each plan lets members in at, which locations a staff member's
-- role applies at, and shop stock per location. Every existing row lands at
-- "main".

-- CreateEnum
CREATE TYPE "LocationAccess" AS ENUM ('HOME', 'SELECTED', 'ALL');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "locationId" TEXT NOT NULL DEFAULT 'main';

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "locationId" TEXT NOT NULL DEFAULT 'main';

-- AlterTable
ALTER TABLE "ClassTemplate" ADD COLUMN     "locationId" TEXT NOT NULL DEFAULT 'main';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "homeLocationId" TEXT NOT NULL DEFAULT 'main';

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "locationAccess" "LocationAccess" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "locationId" TEXT NOT NULL DEFAULT 'main';

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "locationId" TEXT NOT NULL DEFAULT 'main';

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "suburb" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "postcode" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- The main location (D-125). Everything that existed before locations
-- belongs to it, through the column defaults above. Its name and address are
-- set on the Locations page (or by the seed).
INSERT INTO "Location" ("id", "name", "code", "updatedAt") VALUES ('main', 'Main location', 'main', CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "PlanLocation" (
    "planId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "PlanLocation_pkey" PRIMARY KEY ("planId","locationId")
);

-- CreateTable
CREATE TABLE "StaffLocation" (
    "staffId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "StaffLocation_pkey" PRIMARY KEY ("staffId","locationId")
);

-- CreateTable
CREATE TABLE "VariantStock" (
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VariantStock_pkey" PRIMARY KEY ("variantId","locationId")
);

-- Shop stock moves to the main location (D-127). ProductVariant.stockQty is
-- left as it was, for rollback, and no longer read.
INSERT INTO "VariantStock" ("variantId", "locationId", "quantity") SELECT "id", 'main', "stockQty" FROM "ProductVariant";

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE INDEX "VariantStock_locationId_idx" ON "VariantStock"("locationId");

-- CreateIndex
CREATE INDEX "CheckIn_locationId_timestamp_idx" ON "CheckIn"("locationId", "timestamp");

-- CreateIndex
CREATE INDEX "Class_locationId_startTime_idx" ON "Class"("locationId", "startTime");

-- CreateIndex
CREATE INDEX "Order_locationId_status_idx" ON "Order"("locationId", "status");

-- CreateIndex
CREATE INDEX "Shift_locationId_startTime_idx" ON "Shift"("locationId", "startTime");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_homeLocationId_fkey" FOREIGN KEY ("homeLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLocation" ADD CONSTRAINT "PlanLocation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLocation" ADD CONSTRAINT "PlanLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLocation" ADD CONSTRAINT "StaffLocation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLocation" ADD CONSTRAINT "StaffLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStock" ADD CONSTRAINT "VariantStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantStock" ADD CONSTRAINT "VariantStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Payments are reported under a location (D-129): the member's home location
-- for memberships, the order's location for the shop. Existing payments are
-- all the main location's.
ALTER TABLE "Payout" ADD COLUMN "locationId" TEXT NOT NULL DEFAULT 'main';
CREATE INDEX "Payout_locationId_paidAt_idx" ON "Payout"("locationId", "paidAt");
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
