#!/usr/bin/env bash
# Proves every down.sql works: applies all migrations to an empty database,
# rolls back each migration that has a down.sql (newest first), applies them
# again, and checks the result matches schema.prisma. Needs psql and a
# throwaway database whose name contains "test".
set -euo pipefail

url="${ROLLBACK_DATABASE_URL:?Set ROLLBACK_DATABASE_URL to a throwaway test database}"
case "$url" in *test*) ;; *) echo "Refusing: the database name must contain 'test'." >&2; exit 1 ;; esac
# psql doesn't accept Prisma's ?schema= parameter.
psql_url="${url%%\?*}"

DATABASE_URL="$url" npx prisma migrate reset --force --skip-seed --skip-generate >/dev/null

for dir in $(ls -d prisma/migrations/*/ | sort -r); do
  name="$(basename "$dir")"
  [ -f "$dir/down.sql" ] || break
  echo "Rolling back $name"
  psql "$psql_url" -q -v ON_ERROR_STOP=1 -f "$dir/down.sql"
  psql "$psql_url" -q -v ON_ERROR_STOP=1 -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '$name'"
done

echo "Applying again"
DATABASE_URL="$url" npx prisma migrate deploy >/dev/null
# The only allowed difference: rollbacks keep records they would otherwise
# lose in _archived_* tables (R-64), which aren't in the schema.
diff_sql="$(DATABASE_URL="$url" npx prisma migrate diff --from-url "$url" --to-schema-datamodel prisma/schema.prisma --script)"
unexpected="$(printf '%s\n' "$diff_sql" | grep -vE '^(--.*|DROP TABLE "_archived_[a-z0-9_]+";|)$' || true)"
if [ -n "$unexpected" ]; then
  echo "The database after the round trip doesn't match schema.prisma:" >&2
  echo "$unexpected" >&2
  exit 1
fi
echo "Rollback round trip OK"
