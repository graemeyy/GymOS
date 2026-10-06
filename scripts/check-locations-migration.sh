#!/usr/bin/env bash
# Proves the locations migration (D-125) is additive: takes a database to just
# before it, adds rows the way an existing gym would have them, applies it,
# and checks everything landed at the main location with nothing lost. Uses
# the same throwaway database as the rollback check.
set -euo pipefail

url="${ROLLBACK_DATABASE_URL:?Set ROLLBACK_DATABASE_URL to a throwaway test database}"
case "$url" in *test*) ;; *) echo "Refusing: the database name must contain 'test'." >&2; exit 1 ;; esac
psql_url="${url%%\?*}"
migration="20261014000000_locations"
q() { psql "$psql_url" -qAt -v ON_ERROR_STOP=1 -c "$1"; }

DATABASE_URL="$url" npx prisma migrate reset --force --skip-seed --skip-generate >/dev/null
# Back to the schema an existing gym has before this migration.
for dir in $(ls -d prisma/migrations/*/ | sort -r); do
  name="$(basename "$dir")"
  psql "$psql_url" -q -v ON_ERROR_STOP=1 -f "$dir/down.sql"
  q "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '$name'"
  [ "$name" = "$migration" ] && break
done

q "INSERT INTO \"Member\" (id, email, \"updatedAt\") VALUES ('m1', 'one@example.com', now()), ('m2', 'two@example.com', now())"
q "INSERT INTO \"Class\" (id, name, \"startTime\") VALUES ('c1', 'Conditioning', now())"
q "INSERT INTO \"Product\" (id, name, slug, category, \"updatedAt\") VALUES ('p1', 'Tee', 'tee', 'APPAREL', now())"
q "INSERT INTO \"ProductVariant\" (id, \"productId\", sku, \"priceCents\", \"stockQty\", \"updatedAt\") VALUES ('v1', 'p1', 'T-M', 3500, 7, now()), ('v2', 'p1', 'T-L', 3500, 0, now())"
q "INSERT INTO \"CheckIn\" (id, \"memberId\") VALUES ('k1', 'm1')"
q "INSERT INTO \"Payout\" (id, \"memberId\", amount, status) VALUES ('pay1', 'm1', 3000, 'succeeded')"

DATABASE_URL="$url" npx prisma migrate deploy >/dev/null

fail() { echo "Locations migration check failed: $1" >&2; exit 1; }
[ "$(q "SELECT count(*) FROM \"Location\"")" = "1" ] || fail "expected exactly one location"
[ "$(q "SELECT id FROM \"Location\"")" = "main" ] || fail "the location should be 'main'"
[ "$(q "SELECT count(*) FROM \"Member\" WHERE \"homeLocationId\" = 'main'")" = "2" ] || fail "members should be at main"
[ "$(q "SELECT \"locationId\" FROM \"Class\" WHERE id = 'c1'")" = "main" ] || fail "classes should be at main"
[ "$(q "SELECT \"locationId\" FROM \"CheckIn\" WHERE id = 'k1'")" = "main" ] || fail "check-ins should be at main"
[ "$(q "SELECT \"locationId\" FROM \"Payout\" WHERE id = 'pay1'")" = "main" ] || fail "payments should be at main"
[ "$(q "SELECT quantity FROM \"VariantStock\" WHERE \"variantId\" = 'v1' AND \"locationId\" = 'main'")" = "7" ] || fail "stock should move to main"
[ "$(q "SELECT count(*) FROM \"VariantStock\"")" = "2" ] || fail "every variant should have a stock row"
[ "$(q "SELECT count(*) FROM \"MembershipPlan\" WHERE \"locationAccess\" <> 'ALL'")" = "0" ] || fail "plans should cover every location"
echo "Locations migration check OK"
