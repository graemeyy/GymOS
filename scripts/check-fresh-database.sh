#!/usr/bin/env bash
# Proves a brand-new database can be built from the migrations alone (R-68):
# drops a throwaway database, applies every migration from empty, seeds it,
# then checks `prisma migrate status` says it's up to date and the result
# matches schema.prisma exactly. Needs a database whose name contains "test".
set -euo pipefail

url="${FRESH_DATABASE_URL:?Set FRESH_DATABASE_URL to a throwaway test database}"
case "$url" in *test*) ;; *) echo "Refusing: the database name must contain 'test'." >&2; exit 1 ;; esac

echo "Applying every migration to an empty database"
DATABASE_URL="$url" npx prisma migrate reset --force --skip-seed --skip-generate >/dev/null

echo "Seeding"
# A throwaway password, so the seed doesn't print a generated one.
SEED_DEMO_PASSWORD="$(node -e 'console.log(require("crypto").randomBytes(18).toString("base64url"))')" \
  DATABASE_URL="$url" npm run --silent db:seed >/dev/null

echo "Checking migration status"
DATABASE_URL="$url" npx prisma migrate status

echo "Checking the database matches schema.prisma"
DATABASE_URL="$url" npx prisma migrate diff --from-url "$url" --to-schema-datamodel prisma/schema.prisma --exit-code >/dev/null
echo "Fresh database OK"
