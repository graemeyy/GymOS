-- Reverses 20261013000000_branding. The app falls back to the branding in
-- config/gym.config.json; anything set on the Branding page is lost, so
-- note it first: SELECT * FROM "Branding";
-- Roles that were given branding.edit lose it (it doesn't exist before this).
UPDATE "Role" SET "permissions" = array_remove("permissions", 'branding.edit');
UPDATE "Role" SET "description" = 'Everything except the owner-only actions.'
WHERE "id" = 'role_admin' AND "description" = 'Everything except branding and the owner-only actions.';
DROP TABLE "Branding";
