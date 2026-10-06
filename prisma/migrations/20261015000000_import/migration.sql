-- CSV import (D-130, D-131). Additive: one nullable column, and the Owner
-- preset gains the new permission. The Admin preset doesn't get it.

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "importedAt" TIMESTAMP(3);

UPDATE "Role" SET "permissions" = array_append("permissions", 'data.import')
WHERE "id" = 'role_owner' AND NOT ('data.import' = ANY("permissions"));
UPDATE "Role" SET "description" = 'Everything except branding, importing data and the owner-only actions.'
WHERE "id" = 'role_admin';
