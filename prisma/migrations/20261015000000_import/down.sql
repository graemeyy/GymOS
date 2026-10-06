-- Rolls back 20261015000000_import. Which members were imported is lost;
-- their memberships stay as they are.
UPDATE "Role" SET "permissions" = array_remove("permissions", 'data.import');
UPDATE "Role" SET "description" = 'Everything except branding and the owner-only actions.'
WHERE "id" = 'role_admin';

ALTER TABLE "Member" DROP COLUMN "importedAt";
