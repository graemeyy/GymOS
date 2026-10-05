# Merge plan

How to merge the five open pull requests safely, given that Vercel preview builds have probably already run two of the migrations against the production database. Nothing here has been done yet. Every step that changes something is for the owner to run; everything I checked was read-only.

The pull requests, in stack order:

| Order | PR | Branch | Migration it adds |
|---|---|---|---|
| 1 | graemeyy/GymOS#16 | `claude/clever-mayer-i0kufm` | `20261003000000_phase1_foundation` |
| 2 | graemeyy/GymOS#17 | `claude/clever-mayer-i0kufm-owner` | `20261004000000_phase2_owner_features` |
| 3 | graemeyy/GymOS#18 | `claude/clever-mayer-i0kufm-member` | `20261005000000_phase3_member_features` |
| 4 | graemeyy/GymOS#19 | `claude/clever-mayer-i0kufm-fixes` | `20261006000000_review_fixes` |
| 5 | graemeyy/GymOS#20 | `claude/clever-mayer-i0kufm-standard` | none |
| 6 | graemeyy/GymOS#21 | `claude/clever-mayer-i0kufm-permissions` | `20261008000000_roles_and_permissions` |

## 0. Update, 4 October afternoon: read this first

Things have changed since sections 1 to 6 were written:

- **Preview has its own database.** Production keeps the original; Preview has a separate one with `ALLOW_PREVIEW_MIGRATIONS=true` set for Preview only. Section 6 is done.
- **The production data is all demo data.** So the step 3.1 checks and the catch-up migration (section 3) are skipped, and a reset of production is an acceptable way out if a migration fails.
- **The PRs are merged into `main` one at a time, oldest first, each with a normal merge commit.** Unless automatic production deployments are paused, each merge deploys to production and runs `migrate deploy` for that PR's migration. A build that fails leaves the previous production deployment serving, so a failed migration doesn't take the site down; it stops later deploys until it's dealt with (0.3).

### 0.1 Will `migrate deploy` succeed on the current production database?

What I could check, from the repository (I have no access to the database or to Vercel's build logs):

- **No applied migration file has changed.** Every `migration.sql` from `20250101000000_init` to `20261006000000_review_fixes` has exactly one commit in the whole repository history, on any branch: none was edited after it was added. So whatever previews or production deploys applied matches the files being merged now. (`20261008000000_roles_and_permissions` was reworded once before PR 6 was pushed; no build ever applied it, because #21's previews ran with migrations skipped.)
- **No pending migration can trip over existing data.**
  - Every unique index in Phase 1 to 3 is on a new table or a new, empty column.
  - Every new `NOT NULL` column has a default.
  - The backfills (`planId` from the old `plan` enum, `pastDueSince`, `onboardedAt`, `effectiveAt`, `paidAt`, `membershipStartedAt`, staff `roleId`) cover every value the old enums allow.
  - The new enum values (`TRAINER`, `PENDING`) are only used by later migrations, never in the one that adds them.
  - The roles migration maps every old staff role to a role, so no account is left without one.
- **The history should be in order.** `main` has run `prisma migrate deploy` on every build since 8 September, so the seven 2025 migrations should already be recorded in production's `_prisma_migrations`. Phase 1 and 2 were probably applied by previews (section 1). `migrate deploy` skips what's recorded and applies the rest in order.

What I can't check: production's `_prisma_migrations` table itself. Two things there would stop `migrate deploy`, and only a look at the table or the build log shows them:
- **A failed migration** (a row with `finished_at` empty and `rolled_back_at` empty), for example if a preview build's migration was interrupted. `migrate deploy` then refuses with error P3009.
- **A schema made with `prisma db push`** rather than migrations, without history for the 2025 migrations (R-68). The baseline fallback in `scripts/deploy-migrations.js` only marks the first one as applied, and the next would fail with "relation already exists".

**So I'm confident in the files and the data, not in the recorded history.** If the first production build after a merge fails at `migrate deploy`, use 0.3. Since the data is demo, that's the quickest safe fix; don't try to repair the history by hand.

### 0.2 Watching each merge's production deploy

After each merge, open the production deployment's build log in Vercel and look for the `migrate deploy` output:

- "N migrations found ... applied" or "No pending migrations to apply" means it worked.
- `P3009`, `P3018`, `P3005` followed by another error, or "relation ... already exists" means it failed. Stop merging and do 0.3.

### 0.3 Fallback: reset the production database and re-seed it

Only because the data is demo. This deletes everything in the production database.

From a trusted machine with the repository at the latest `main` (or at the branch being merged). Put the production connection string in your shell, never in the repository or a chat:

```sh
# 1. Optional: keep a copy, in case anything turns out to matter.
pg_dump --format=custom --no-owner --file=gymos-prod-before-reset.dump "$PRODUCTION_DATABASE_URL"

# 2. Drop everything and apply every migration from scratch.
DATABASE_URL="$PRODUCTION_DATABASE_URL" npx prisma migrate reset --force --skip-seed

# 3. Fill it with the fictional demo data. The seed refuses NODE_ENV=production,
#    so run it from your machine, not from a Vercel build. It only fills an
#    empty database, which it now is. Without SEED_DEMO_PASSWORD it prints a
#    random password for the demo accounts once, in your terminal; or set
#    SEED_DEMO_PASSWORD in your shell first to choose one.
DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run db:seed

# 4. Check the history is complete: every migration listed, none failed.
DATABASE_URL="$PRODUCTION_DATABASE_URL" npx prisma migrate status
```

Then redeploy production (Vercel → Deployments → the latest `main` deployment → Redeploy). Its `migrate deploy` should report no pending migrations.

After the reset:
- **Demo accounts start with the password the seed printed or `SEED_DEMO_PASSWORD`.** Nothing in the repository says what it is (D-110), and each account must choose its own at first sign-in (D-111). Sign in as the owner first and change it, and deactivate the demo staff accounts you don't need.
- **Sessions end.** Everyone is signed out, because their accounts no longer exist.
- **Stripe test data no longer matches.** Test-mode customers and subscriptions in Stripe point at members that are gone. Harmless in test mode; webhooks for them are ignored.
- Without the seed, the database is empty. The first owner is then created at `/admin/setup`, which needs `SETUP_TOKEN` set in Production (D-083).

## 1. What has probably already happened to production

Production and Preview share one `DATABASE_URL`. Until the preview guard (D-060, commit `0404448`, 4 October 00:14 UTC), every build, preview builds included, ran `prisma migrate deploy`.

- **Phase 1 (`20261003000000_phase1_foundation`): probably applied.** PR #16 was pushed at about 23:23 UTC on 3 October without the guard, and its preview builds would have applied it.
- **Phase 2 (`20261004000000_phase2_owner_features`): probably applied.** PR #17's branch was pushed at 00:09, 00:10 and 00:12 without the guard, before the guard was merged into it at 00:14.
- **Phase 3 and the review fixes: not applied by previews.** Every commit containing them also contains the guard, so their preview builds skipped migrations. The preview of PR #19 built at 04:01 on 4 October ran with the guard too.

I couldn't confirm this from the build logs: the Vercel connector is refused for the `graemeys-projects` team (403). The read-only query in step 3.1 settles it.

**Nothing needs rolling back.** Both migrations only add things: new tables, new nullable columns, new columns with defaults, one new enum value, indexes and foreign keys. They don't drop, rename or retype anything the current `main` code uses, so the live site has kept working on the old code. Rolling them back would only discard Phase 1 and 2 data structures that the merge needs anyway.

## 2. Checksums: no edited migrations

Prisma stores a SHA-256 of each `migration.sql` when it applies it. `migrate deploy` stops with an error if a file that's already applied has since changed. I checked:

- Each of the four new `migration.sql` files was written in a single commit and never edited. The Phase 2 change made during the review touched only its `down.sql`, which Prisma doesn't checksum.
- Each file is byte-identical on every branch and at every head, plain ASCII with LF line endings, and there's no `.gitattributes` that could change line endings on checkout.
- None of the seven older prototype migrations is changed on any branch.

So no fix is needed here. These are the checksums production should hold:

| Migration | SHA-256 of `migration.sql` |
|---|---|
| `20250101000000_init` | `5155ff8a7cf036639dc16a0eda68c8df2663e15dc67f1ed9e5741cfce24d07fe` |
| `20250201000000_add_classes_and_settings` | `0305e81eed92a6a0919fcf56b5cbfb9b06142a0eac7caffcfc3fc07b1fc06e1e` |
| `20250301000000_add_staff_and_audit_log` | `5197a1ff276529d4747b3b5ed6da69e47fd917a9ea930a094de5c1e65a660e7c` |
| `20250401000000_add_class_waitlist` | `9ceecd2307fed20afc8194939945ca557e0dfa042c60da453881a983ad0b8cad` |
| `20250501000000_add_shifts_attendance_referrals` | `276abb87b59258edaedee235bca47a5ddf3d600d9e84b3da3f3aa661d81a84bd` |
| `20250601000000_add_gym_settings` | `d08d40a9510efb08ca7518e6433b299368669aa8e1a7c2f09bcf94c225636a8d` |
| `20250701000000_add_inventory_item` | `79a2efa5d041b134007bdb69f8806e63c381de5334325346c453bee437a9e02f` |
| `20261003000000_phase1_foundation` | `45ba8c72788e06ae265eb49d1ab2341d87744454fa6d4ec2826f2559cd91117e` |
| `20261004000000_phase2_owner_features` | `234e909cb1d0650ee143ac745ca93d0bf4581c56aa83024e292c3b09cd5d6c79` |
| `20261005000000_phase3_member_features` | `c6aefe7818b43303ca1f5d5a769e2c882a0347b1d90bccc6ffbe6ea8f54596ed` |
| `20261006000000_review_fixes` | `73940c2ef96e939e25c33a58548bf33985cdb45a9f971b753b3a92a937c228af` |

If step 3.1 shows a different checksum for an applied migration, stop and send me the row: the fix is `prisma migrate resolve`, chosen case by case, never editing the file.

## 3. The real problem: data written by the old code since

The Phase 1 and Phase 2 migrations contain one-off backfills that ran when the preview build applied them. Since then, the live site (still the old `main` code) has kept writing rows the backfills don't cover, because the old code doesn't know the new columns. Once the new code is live, it reads those columns:

| Written by the old code since the migrations | What the new code will see |
|---|---|
| New members, or members whose plan changed | `planId` empty or stale, so the member shows "No plan" and gets no plan benefits |
| Payments recorded by the old Stripe webhook | `gstCents` = 0, so the tax invoice and GST reports show no GST |
| Notes edited in the old single notes field | The note history doesn't have the latest text |
| Members who went past due | `pastDueSince` empty, so the reminder and suspension clock doesn't start |

None of this loses data: the old columns (`Member.plan`, `Member.notes`) are still there. It needs a one-off catch-up, run **after** the old code has stopped writing, which means in the same deployment that first ships the new code. Step 4 arranges that.

### 3.1 Read-only checks (owner runs these against production)

Run them with a read-only database role if one exists. Each one only reads.

```sql
-- Which migrations are applied, with checksums. Compare with the table in section 2.
-- finished_at must be set and rolled_back_at empty on every row.
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count
FROM "_prisma_migrations" ORDER BY started_at;

-- How much the old code has written since Phase 1 and 2 ran.
SELECT count(*) AS members_without_plan_id
FROM "Member" WHERE "planId" IS NULL;

SELECT count(*) AS members_with_stale_plan_id
FROM "Member" WHERE "planId" LIKE 'legacy\_%' AND "planId" <> 'legacy_' || lower("plan"::text);

SELECT count(*) AS payments_without_gst
FROM "Payout"
WHERE "gstCents" = 0
  AND "createdAt" > (SELECT finished_at FROM "_prisma_migrations" WHERE migration_name = '20261003000000_phase1_foundation');

SELECT count(*) AS notes_not_in_history
FROM "Member" m
WHERE m."notes" IS NOT NULL AND btrim(m."notes") <> ''
  AND NOT EXISTS (SELECT 1 FROM "MemberNote" n WHERE n."memberId" = m."id" AND n."body" = m."notes");

SELECT count(*) AS past_due_without_start
FROM "Member" WHERE "status" = 'PAST_DUE' AND "pastDueSince" IS NULL;
```

If the first query shows neither `20261003000000_phase1_foundation` nor `20261004000000_phase2_owner_features`, the previews never migrated. Ignore the catch-up and follow step 4 without it.

### 3.2 The catch-up (proposed, not written yet)

When you've sent me the counts, I'll add this as an additive migration on PR #19 (`20261007000000_catch_up_old_code_writes`). It changes data only: no schema change and nothing to reverse. It's idempotent, so it's safe even if nothing has drifted.

```sql
-- Members added or moved by the old code: point them at their legacy plan.
UPDATE "Member" m SET "planId" = 'legacy_' || lower(m."plan"::text)
WHERE (m."planId" IS NULL OR (m."planId" LIKE 'legacy\_%' AND m."planId" <> 'legacy_' || lower(m."plan"::text)))
  AND EXISTS (SELECT 1 FROM "MembershipPlan" p WHERE p."id" = 'legacy_' || lower(m."plan"::text));

-- Notes edited in the old field since the import: add the current text to the history.
INSERT INTO "MemberNote" ("id", "memberId", "staffName", "body", "createdAt")
SELECT 'imported2_' || m."id", m."id", 'Imported from earlier notes', m."notes", m."updatedAt"
FROM "Member" m
WHERE m."notes" IS NOT NULL AND btrim(m."notes") <> ''
  AND NOT EXISTS (SELECT 1 FROM "MemberNote" n WHERE n."memberId" = m."id" AND n."body" = m."notes")
ON CONFLICT ("id") DO NOTHING;

-- Members who went past due under the old code start their clock now.
UPDATE "Member" SET "pastDueSince" = CURRENT_TIMESTAMP WHERE "status" = 'PAST_DUE' AND "pastDueSince" IS NULL;
```

If production had no members when Phase 1 ran, no legacy plans exist and members added since keep an empty plan; assign their plans in the console after the deploy.

GST on payments recorded since is deliberately **not** in this script. Those payments may not be AUD: the old code formats prices as USD. Whether they include GST is a tax question for the owner, not something to backfill blindly. If `payments_without_gst` isn't 0, list them and decide with your accountant. The new code records GST correctly from the moment it's live.

## 4. Merge order

The safest approach is **one production deployment at the end**, not one per pull request. That keeps the catch-up in the same deployment as the first new code, and avoids running in-between states in production.

**Before anything:**

1. **Give previews their own database** (section 6). At the moment every preview deployment, not only its build, connects to production. The previews of #18 and #19 expect tables production doesn't have yet, and any preview someone opens reads and writes real data.
2. **Back up production.**
   - Use your provider's snapshot or point-in-time restore if it has one; note the restore point.
   - Otherwise, from a trusted machine: `pg_dump --format=custom --no-owner --file=gymos-before-merge.dump "$PRODUCTION_DATABASE_URL"`.
   - **Prove the backup restores:** `pg_restore --no-owner --dbname="$SCRATCH_DATABASE_URL" gymos-before-merge.dump` into an empty scratch database.
3. **Rehearse on the restored copy.**
   - Check out PR 5's branch.
   - Point `DATABASE_URL` at the scratch copy and run `npx prisma migrate deploy`.
   - It should apply exactly the migrations missing from step 3.1 and nothing else, with no errors.
   - Then run `npx prisma migrate diff --from-url "$SCRATCH_DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code`. It should report no difference.
4. **Run the step 3.1 checks** and send me the results. I'll add the catch-up migration to #19 if needed.
5. **Pause automatic production deployments** in Vercel (Project → Settings → Git: turn off automatic deployments for `main`, or add an Ignored Build Step that skips `main`), so the merges below don't each deploy.

**Merging (GitHub only, no deployments while paused):**

| Step | Action | What `migrate deploy` would do if this were deployed | Notes |
|---|---|---|---|
| 6 | Merge #16 into `main` | Skips Phase 1 if already applied | Then change #17's base to `main` |
| 7 | Merge #17 into `main` | Skips Phase 2 if already applied | Then change #18's base to `main` |
| 8 | Merge #18 into `main` | Applies Phase 3 | Then change #19's base to `main` |
| 9 | Merge #19 into `main` | Applies the review fixes, then the catch-up | Then change PR 5's base to `main` |
| 10 | Merge PR 5 into `main` | Nothing new | Then change PR 6's (#21) base to `main` |
| 10a | Merge PR 6 (#21) into `main`, if it's going out in the same deployment | Applies the roles and permissions migration | Wait for CI on `main` to pass. PR 6 can also wait for a later deployment: nothing above depends on it |

**Deploying:**

11. Turn automatic production deployments back on, or deploy `main` by hand. The production build runs `node scripts/deploy-migrations.js` (`prisma migrate deploy`), then `next build`. On a production database matching section 1, it applies:
    - `20261005000000_phase3_member_features`
    - `20261006000000_review_fixes`
    - the catch-up, if added
    - `20261008000000_roles_and_permissions`, if PR 6 was merged
12. **Check the build log** for `migrate deploy`'s list of applied migrations and the absence of errors.
13. **Smoke-test production:**
    - sign in as owner
    - open members (plans shown), payments, finance and the shop
    - check in a member
    - run step 3.1 again: the catch-up counts should be 0, except `payments_without_gst`
    - if PR 6 went out: every staff member has a role (`SELECT count(*) FROM "Staff" WHERE "roleId" IS NULL;` should be 0), open Staff and Roles, and sign in as a front-desk account to check it sees what you expect (D-100 narrows Front desk)
14. **Set `SETUP_TOKEN` in Production** if you haven't (D-083).
15. **Set the Stripe webhook endpoint's API version** to `2023-10-16` (see the README).

**PR 6's migration** creates the `Role` table, inserts the five starting roles and moves every staff account onto one in the same transaction, so nobody is signed out. In the step 3 rehearsal, check that `SELECT "role", count(*) FROM "Staff" WHERE "roleId" IS NULL GROUP BY 1;` returns no rows afterwards. Its `down.sql` deletes staff who never accepted an invitation (the old schema needs a password) and archives audit old/new values and custom roles into `_archived_*` tables.

**Expected effects of the review migration on a live database:**
- It adds nullable columns and indexes, and runs backfills on `BenefitLedger`, `Payout` and `Member`.
- On a gym-sized database this takes seconds.
- The `Payout` backfill rewrites every payment row, so run the deploy outside opening hours.

## 5. Rolling back

**Code first, schema almost never.** Every migration is additive, and older code keeps working on the newer schema, so the fast and safe rollback is the code:

- **Code rollback:** Vercel → Deployments → the previous production deployment → Instant Rollback (or Promote). This doesn't touch the database. It's the right move for almost any problem found in step 13.
- **Schema rollback** is only for a migration that failed part-way or did damage. Even then, restoring the backup is usually cleaner. If you need it:
  1. Roll the code back first.
  2. Run the `down.sql` files newest first, only for the migrations you're undoing, e.g. `psql "$PRODUCTION_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/20261006000000_review_fixes/down.sql`.
  3. Remove each one's history row: `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261006000000_review_fixes';`.

  The rollbacks keep financial records: refunds, orders and invoice numbers move to `_archived_*` tables instead of being dropped (R-64). CI proves each `down.sql` round-trips (`npm run check:rollback`).
- **A failed migration** (`migrate deploy` stops with P3009 on the next deploy):
  1. Restore the backup, or fix the cause.
  2. Run `npx prisma migrate resolve --rolled-back <name>` against production.
  3. Redeploy.

  Don't mark a half-applied migration as applied.
- **Full restore:** `pg_restore --clean --if-exists --no-owner --dbname="$PRODUCTION_DATABASE_URL" gymos-before-merge.dump`, or your provider's point-in-time restore to the time noted in step 2. Then roll the code back to match.

## 6. Giving previews their own database

The guard stops preview builds migrating production, but preview deployments still connect to it at runtime. Give Preview its own `DATABASE_URL`, in order of preference:

1. **A branch per preview, from your database provider.**
   - Neon's Vercel integration (or Supabase branching) creates a database branch for each preview deployment and sets that preview's `DATABASE_URL` automatically.
   - Previews then get realistic data without touching production.
   - Set `ALLOW_PREVIEW_MIGRATIONS=true` for the Preview environment only, so each branch gets its PR's migrations.
   - Check that production data copied into branches is acceptable under the privacy policy. Otherwise branch from a sanitised copy.
2. **One shared staging database.**
   - In Vercel → Settings → Environment Variables, set `DATABASE_URL` for **Preview** to a separate database, filled with the fictional seed (`npm run db:seed` on the empty database), and `ALLOW_PREVIEW_MIGRATIONS=true` for Preview.
   - Simple, but concurrent PRs share it, and a PR's migration affects the others.
3. **At minimum:**
   - Remove `DATABASE_URL` from Preview entirely, so previews can't reach production at all (they'll show errors where they need data).
   - Keep Vercel's Deployment Protection on for previews.

Whichever you choose, also give Preview its own `SESSION_SECRET`, Stripe **test** keys (never live) and no `RESEND_API_KEY`, so previews can't sign people into production sessions, take payments or email members.
