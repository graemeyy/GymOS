-- D-124: the gym's branding, editable on the Branding page. Every column is
-- optional; empty means the default from config/gym.config.json.
CREATE TABLE "Branding" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT,
    "appName" TEXT,
    "tagline" TEXT,
    "logoText" TEXT,
    "primaryColour" TEXT,
    "accentColour" TEXT,
    "bodyFont" TEXT,
    "displayFont" TEXT,
    "emailSenderName" TEXT,
    "emailFooter" TEXT,
    "legalName" TEXT,
    "abn" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "suburb" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "logoData" BYTEA,
    "logoType" TEXT,
    "iconData" BYTEA,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "imagesUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Branding_pkey" PRIMARY KEY ("id")
);

-- The new permission (lib/auth/permissions.ts): the Owner preset lists it,
-- and the Admin preset says it doesn't have it. Owners have every permission
-- anyway; this keeps the stored role in step with the preset.
UPDATE "Role" SET "permissions" = array_append("permissions", 'branding.edit')
WHERE "id" = 'role_owner' AND NOT ('branding.edit' = ANY("permissions"));
UPDATE "Role" SET "description" = 'Everything except branding and the owner-only actions.'
WHERE "id" = 'role_admin' AND "description" = 'Everything except the owner-only actions.';
