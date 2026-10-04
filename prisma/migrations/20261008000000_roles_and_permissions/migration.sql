-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteTokenHash" TEXT,
ADD COLUMN     "roleId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "preset" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_preset_key" ON "Role"("preset");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_inviteTokenHash_key" ON "Staff"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "Staff_roleId_idx" ON "Staff"("roleId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The five preset roles (lib/auth/permissions.ts PRESET_ROLES). Fixed IDs so
-- code and the rollback can find them.
INSERT INTO "Role" ("id", "name", "description", "preset", "isOwner", "permissions", "updatedAt") VALUES
  ('role_owner', 'Owner', 'Everything, including the owner-only actions.', 'OWNER', true,
   ARRAY['members.view','members.view_sensitive','members.edit','classes.manage','bookings.manage','checkin.scan','orders.manage','products.edit','prices.edit','plans.edit','finance.view','finance.export','refunds.issue','announcements.send','settings.edit','staff.manage','roles.manage','audit.view'], CURRENT_TIMESTAMP),
  ('role_admin', 'Admin', 'Everything except the owner-only actions.', 'ADMIN', false,
   ARRAY['members.view','members.view_sensitive','members.edit','classes.manage','bookings.manage','checkin.scan','orders.manage','products.edit','prices.edit','plans.edit','finance.view','finance.export','refunds.issue','announcements.send','settings.edit','staff.manage','roles.manage','audit.view'], CURRENT_TIMESTAMP),
  ('role_manager', 'Manager', 'Runs the gym day to day and sees the money, but can''t change prices, settings, plans, staff or roles.', 'MANAGER', false,
   ARRAY['members.view','members.view_sensitive','members.edit','classes.manage','bookings.manage','checkin.scan','orders.manage','products.edit','refunds.issue','announcements.send','finance.view','audit.view'], CURRENT_TIMESTAMP),
  ('role_staff', 'Front desk', 'Checks members in, handles bookings and shop orders, and sees schedules and members. No prices, settings or money.', 'STAFF', false,
   ARRAY['members.view','checkin.scan','bookings.manage','orders.manage'], CURRENT_TIMESTAMP),
  ('role_trainer', 'Trainer', 'Their own classes and attendance, and only the member details those classes need.', 'TRAINER', false,
   ARRAY[]::TEXT[], CURRENT_TIMESTAMP)
ON CONFLICT ("preset") DO NOTHING;

-- Every existing staff member gets the preset matching their old fixed role.
UPDATE "Staff" SET "roleId" = CASE "role"
  WHEN 'OWNER' THEN 'role_owner'
  WHEN 'MANAGER' THEN 'role_manager'
  WHEN 'FRONT_DESK' THEN 'role_staff'
  WHEN 'TRAINER' THEN 'role_trainer'
END
WHERE "roleId" IS NULL;
