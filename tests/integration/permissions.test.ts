// PR 6: roles stored in the database, the safeguards around them, staff
// invitations, price permissions, audit old/new values and trainer scope.
// The route-by-role matrix is in rbac.test.ts.
import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { call, createMember, createStaff, createStaffWith, makeRequest, prisma, resetDb, type As } from "../helpers";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import { LEGACY_ROLE_PRESET, PRESET_ROLES, PRESETS } from "@/lib/auth/permissions";
import { SESSION_COOKIE } from "@/lib/auth/token";
import * as staffById from "@/app/api/staff/[id]/route";
import * as staffInvite from "@/app/api/staff/invite/route";
import * as staffResend from "@/app/api/staff/[id]/invite/route";
import * as roles from "@/app/api/roles/route";
import * as roleById from "@/app/api/roles/[id]/route";
import * as invite from "@/app/api/auth/invite/route";
import * as login from "@/app/api/auth/login/route";
import * as authMe from "@/app/api/auth/me/route";
import * as payments from "@/app/api/payments/route";
import * as planById from "@/app/api/plans/[id]/route";
import * as adminPlans from "@/app/api/admin/plans/route";
import * as products from "@/app/api/products/route";
import * as productById from "@/app/api/products/[id]/route";
import * as features from "@/app/api/settings/features/route";
import * as refund from "@/app/api/payments/[id]/refund/route";
import * as classes from "@/app/api/classes/route";
import * as classBook from "@/app/api/classes/[id]/book/route";
import * as members from "@/app/api/members/route";

beforeEach(resetDb);
afterEach(() => captureEmailsForTests(false));

const put = (as: As, body: unknown) => makeRequest("PUT", "/x", { as, body });
const post = (as: As, body?: unknown) => makeRequest("POST", "/x", { as, body });
const del = (as: As) => makeRequest("DELETE", "/x", { as });
type InviteBody = { emailed: boolean; inviteUrl: string; staff: { id: string } };
const inviteOf = (res: { body: unknown }) => res.body as InviteBody;
const tokenOf = (res: { body: unknown }) => new URL(inviteOf(res).inviteUrl).searchParams.get("token");
const as = async (role: Parameters<typeof createStaff>[0]): Promise<As> => ({ staff: await createStaff(role) });

describe("preset roles in the database", () => {
  // The migration seeds the presets; PRESET_ROLES is what the code and the
  // docs say they are. They must not drift apart.
  it("the migration creates exactly the presets in lib/auth/permissions.ts", () => {
    const sql = readFileSync(join(process.cwd(), "prisma/migrations/20261008000000_roles_and_permissions/migration.sql"), "utf8");
    const rows = [...sql.matchAll(/\('role_(\w+)', '((?:[^']|'')*)', '((?:[^']|'')*)', '(\w+)', (true|false),\s*ARRAY\[([^\]]*)\]/g)];
    const parsed = Object.fromEntries(
      rows.map(([, id, name, description, preset, isOwner, perms]) => [
        preset,
        { id, name: name.replace(/''/g, "'"), description: description.replace(/''/g, "'"), isOwner: isOwner === "true", permissions: [...perms.matchAll(/'([^']+)'/g)].map((m) => m[1]) },
      ])
    );
    expect(Object.keys(parsed).sort()).toEqual([...PRESETS].sort());
    for (const p of PRESETS) expect(parsed[p]).toMatchObject({ id: p.toLowerCase(), name: PRESET_ROLES[p].name, isOwner: PRESET_ROLES[p].isOwner });
    for (const [legacy, preset] of Object.entries(LEGACY_ROLE_PRESET)) expect(sql).toContain(`WHEN '${legacy}' THEN 'role_${preset.toLowerCase()}'`);
  });

  // Later migrations keep the stored presets in step with the code, as when
  // branding.edit was added (D-124).
  it("after every migration, the stored presets match lib/auth/permissions.ts", async () => {
    for (const p of PRESETS) {
      const row = await prisma.role.findUniqueOrThrow({ where: { id: `role_${p.toLowerCase()}` } });
      expect({ name: row.name, description: row.description, isOwner: row.isOwner, permissions: [...row.permissions].sort() }, p).toEqual({
        name: PRESET_ROLES[p].name,
        description: PRESET_ROLES[p].description,
        isOwner: PRESET_ROLES[p].isOwner,
        permissions: [...PRESET_ROLES[p].permissions].sort(),
      });
    }
  });

  it("/api/auth/me reports the role and its permissions", async () => {
    const desk = await as("STAFF");
    const res = await call(authMe.GET, await makeRequest("GET", "/api/auth/me", { as: desk }));
    expect(res.body).toMatchObject({ kind: "staff", roleId: "role_staff", roleName: "Front desk", isOwner: false });
    expect([...(res.body.permissions as string[])].sort()).toEqual([...PRESET_ROLES.STAFF.permissions].sort());
  });

  it("a change to a role applies to everyone on it at their next request", async () => {
    const owner = await as("OWNER");
    const desk = await as("STAFF");
    expect((await call(payments.GET, await makeRequest("GET", "/api/payments", { as: desk }))).status).toBe(403);
    const res = await call(roleById.PUT, await put(owner, { permissions: [...PRESET_ROLES.STAFF.permissions, "finance.view"] }), { id: "role_staff" });
    expect(res.status).toBe(200);
    expect((await call(payments.GET, await makeRequest("GET", "/api/payments", { as: desk }))).status).toBe(200);
  });
});

describe("safeguards", () => {
  it("nobody changes their own role or deactivates themselves", async () => {
    const owner = await as("OWNER");
    const id = (owner as { staff: { id: string } }).staff.id;
    expect((await call(staffById.PUT, await put(owner, { roleId: "role_admin" }), { id })).status).toBe(409);
    expect((await call(staffById.PUT, await put(owner, { active: false }), { id })).status).toBe(409);
    expect((await prisma.staff.findUniqueOrThrow({ where: { id } })).roleId).toBe("role_owner");
  });

  it("a non-owner can't demote, deactivate or edit an owner, or give anyone the Owner role", async () => {
    const admin = await as("ADMIN");
    const owner = await createStaff("OWNER");
    const desk = await createStaff("STAFF");
    expect((await call(staffById.PUT, await put(admin, { roleId: "role_admin" }), { id: owner.id })).status).toBe(403);
    expect((await call(staffById.PUT, await put(admin, { active: false }), { id: owner.id })).status).toBe(403);
    expect((await call(staffById.PUT, await put(admin, { roleId: "role_owner" }), { id: desk.id })).status).toBe(403);
    expect((await call(staffInvite.POST, await post(admin, { name: "New Owner", email: "new.owner@example.com", roleId: "role_owner" }))).status).toBe(403);
    expect((await call(roleById.PUT, await put(admin, { name: "Boss" }), { id: "role_owner" })).status).toBe(403);
    expect(await prisma.staff.findUniqueOrThrow({ where: { id: owner.id }, select: { roleId: true, deactivatedAt: true } })).toEqual({ roleId: "role_owner", deactivatedAt: null });
    expect((await prisma.staff.findUniqueOrThrow({ where: { id: desk.id } })).roleId).toBe("role_staff");
  });

  it("an owner can make someone else an owner, and demote another owner", async () => {
    const owner = await as("OWNER");
    const other = await createStaff("ADMIN");
    expect((await call(staffById.PUT, await put(owner, { roleId: "role_owner" }), { id: other.id })).status).toBe(200);
    expect((await call(staffById.PUT, await put(owner, { roleId: "role_admin" }), { id: other.id })).status).toBe(200);
  });

  it("there's always at least one active owner, even when two owners demote each other at once", async () => {
    const a = await createStaff("OWNER");
    const b = await createStaff("OWNER");
    const results = await Promise.all([call(staffById.PUT, await put({ staff: a }, { roleId: "role_admin" }), { id: b.id }), call(staffById.PUT, await put({ staff: b }, { roleId: "role_admin" }), { id: a.id })]);
    expect(results.map((r) => r.status)).not.toEqual([200, 200]);
    expect(await prisma.staff.count({ where: { deactivatedAt: null, assignedRole: { isOwner: true } } })).toBe(1);
  });

  it("nobody can give permissions they don't have, through a role or an invitation", async () => {
    const lead = await as({ roleId: (await prisma.role.create({ data: { name: "Desk lead", permissions: ["members.view", "checkin.scan", "staff.manage", "roles.manage"] } })).id });
    // A role with more than the lead has: refused.
    expect((await call(roles.POST, await post(lead, { name: "Money", permissions: ["finance.view"] }))).status).toBe(403);
    expect((await call(staffInvite.POST, await post(lead, { name: "New Manager", email: "new.manager@example.com", roleId: "role_manager" }))).status).toBe(403);
    expect((await call(roleById.PUT, await put(lead, { name: "Renamed" }), { id: "role_manager" })).status).toBe(403);
    // Within what the lead has: allowed.
    const created = await call(roles.POST, await post(lead, { name: "Door", permissions: ["checkin.scan"] }));
    expect(created.status).toBe(201);
    expect((await call(roleById.PUT, await put(lead, { permissions: ["checkin.scan", "finance.view"] }), { id: String(created.body.id) })).status).toBe(403);
    expect((await call(roleById.PUT, await put(lead, { permissions: ["checkin.scan", "members.view"] }), { id: String(created.body.id) })).status).toBe(200);
    expect((await call(staffInvite.POST, await post(lead, { name: "Door Person", email: "door@example.com", roleId: String(created.body.id) }))).status).toBe(201);
    expect(await prisma.role.findUnique({ where: { name: "Money" } })).toBeNull();
  });

  it("a non-owner can't change someone whose role is more powerful than theirs", async () => {
    const lead = await as({ roleId: (await prisma.role.create({ data: { name: "Desk lead", permissions: ["members.view", "checkin.scan", "staff.manage"] } })).id });
    const manager = await createStaff("MANAGER");
    expect((await call(staffById.PUT, await put(lead, { active: false }), { id: manager.id })).status).toBe(403);
    expect((await call(staffResend.POST, await post(lead), { id: manager.id })).status).toBe(403);
  });

  it("the Owner role always has every permission and presets can't be deleted", async () => {
    const owner = await as("OWNER");
    expect((await call(roleById.PUT, await put(owner, { permissions: [] }), { id: "role_owner" })).status).toBe(409);
    expect((await call(roleById.PUT, await put(owner, { description: "The boss" }), { id: "role_owner" })).status).toBe(200);
    for (const id of ["role_owner", "role_admin", "role_staff"]) expect((await call(roleById.DELETE, await del(owner), { id })).status).toBe(409);
  });

  it("a custom role can be deleted only once nobody has it", async () => {
    const owner = await as("OWNER");
    const role = await prisma.role.create({ data: { name: "Cleaners", permissions: [] } });
    const person = await createStaff({ roleId: role.id });
    expect((await call(roleById.DELETE, await del(owner), { id: role.id })).status).toBe(409);
    await prisma.staff.update({ where: { id: person.id }, data: { roleId: "role_trainer" } });
    expect((await call(roleById.DELETE, await del(owner), { id: role.id })).status).toBe(200);
    expect(await prisma.role.findUnique({ where: { id: role.id } })).toBeNull();
  });

  it("a role name must be unique", async () => {
    const owner = await as("OWNER");
    expect((await call(roles.POST, await post(owner, { name: "Manager", permissions: [] }))).status).toBe(409);
  });

  it("a role change or deactivation signs the person out at once", async () => {
    const owner = await as("OWNER");
    const desk = await createStaff("STAFF");
    const deskAs: As = { staff: desk };
    expect((await call(authMe.GET, await makeRequest("GET", "/api/auth/me", { as: deskAs }))).status).toBe(200);
    expect((await call(staffById.PUT, await put(owner, { roleId: "role_trainer" }), { id: desk.id })).status).toBe(200);
    expect((await call(authMe.GET, await makeRequest("GET", "/api/auth/me", { as: deskAs }))).status).toBe(401);
  });
});

describe("staff invitations", () => {
  it("invites by email; the link sets a password once and signs them in", async () => {
    captureEmailsForTests(true);
    const owner = await as("OWNER");
    const res = await call(staffInvite.POST, await post(owner, { name: "Ari Wong", email: "ari@example.com", roleId: "role_staff" }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ emailed: true, inviteUrl: null, staff: { name: "Ari Wong", status: "invited", role: { id: "role_staff" } } });
    const email = capturedEmails().find((e) => e.to === "ari@example.com");
    const token = email?.text.match(/token=([\w-]+)/)?.[1];
    expect(token).toBeTruthy();

    // Not usable before the password is set.
    expect((await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "ari@example.com", password: "anything-at-all" } }))).status).toBe(401);

    const info = await call(invite.GET, await makeRequest("GET", `/api/auth/invite?token=${token}`));
    expect(info.body).toEqual({ name: "Ari Wong", email: "ari@example.com" });

    const accepted = await call(invite.POST, await makeRequest("POST", "/api/auth/invite", { body: { token, password: "a-strong-new-password" } }));
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=`);
    expect((await call(invite.POST, await makeRequest("POST", "/api/auth/invite", { body: { token, password: "another-password-1" } }))).status).toBe(404);

    const signIn = await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "ari@example.com", password: "a-strong-new-password" } }));
    expect(signIn.status).toBe(200);
    const row = await prisma.staff.findUniqueOrThrow({ where: { email: "ari@example.com" } });
    expect(row.inviteTokenHash).toBeNull();
    expect(row.passwordHash).not.toBeNull();
    expect(await prisma.auditLog.findMany({ where: { targetId: row.id }, orderBy: { createdAt: "asc" }, select: { action: true } })).toEqual(
      expect.arrayContaining([{ action: "staff.invited" }, { action: "staff.invite_accepted" }, { action: "staff.signed_in" }])
    );
  });

  it("returns the link to pass on when email isn't set up, and stores only a hash of it", async () => {
    const owner = await as("OWNER");
    const res = await call(staffInvite.POST, await post(owner, { name: "Bo", email: "bo@example.com", roleId: "role_trainer" }));
    expect(res.body.emailed).toBe(false);
    const token = tokenOf(res)!;
    const row = await prisma.staff.findUniqueOrThrow({ where: { email: "bo@example.com" } });
    expect(row.inviteTokenHash).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("resending makes the old link stop working", async () => {
    const owner = await as("OWNER");
    const first = await call(staffInvite.POST, await post(owner, { name: "Cy", email: "cy@example.com", roleId: "role_trainer" }));
    const oldToken = tokenOf(first);
    const again = await call(staffResend.POST, await post(owner), { id: inviteOf(first).staff.id });
    const newToken = tokenOf(again);
    expect(newToken).not.toBe(oldToken);
    expect((await call(invite.GET, await makeRequest("GET", `/api/auth/invite?token=${oldToken}`))).status).toBe(404);
    expect((await call(invite.GET, await makeRequest("GET", `/api/auth/invite?token=${newToken}`))).status).toBe(200);
  });

  it("an expired link, or one for a deactivated account, doesn't work", async () => {
    const owner = await as("OWNER");
    const res = await call(staffInvite.POST, await post(owner, { name: "Di", email: "di@example.com", roleId: "role_trainer" }));
    const token = tokenOf(res);
    await prisma.staff.update({ where: { id: inviteOf(res).staff.id }, data: { inviteExpiresAt: new Date(Date.now() - 1000) } });
    expect((await call(invite.POST, await makeRequest("POST", "/api/auth/invite", { body: { token, password: "a-strong-new-password" } }))).status).toBe(404);
    await prisma.staff.update({ where: { id: inviteOf(res).staff.id }, data: { inviteExpiresAt: new Date(Date.now() + 86_400_000), deactivatedAt: new Date() } });
    expect((await call(invite.POST, await makeRequest("POST", "/api/auth/invite", { body: { token, password: "a-strong-new-password" } }))).status).toBe(404);
  });

  it("refuses an email that already has a staff account", async () => {
    const owner = await as("OWNER");
    await createStaff("STAFF", { email: "taken@example.com" });
    expect((await call(staffInvite.POST, await post(owner, { name: "Ed", email: "taken@example.com", roleId: "role_staff" }))).status).toBe(409);
  });
});

describe("deactivation and sign-in audit (R-84)", () => {
  it("a deactivated account can't sign in, and failed sign-ins are recorded against the account", async () => {
    const desk = await createStaff("STAFF", { email: "desk@example.com", password: "desk-password-1" });
    const wrong = await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "desk@example.com", password: "not-the-password" } }));
    expect(wrong.status).toBe(401);
    await prisma.staff.update({ where: { id: desk.id }, data: { deactivatedAt: new Date() } });
    const blocked = await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "desk@example.com", password: "desk-password-1" } }));
    expect(blocked.status).toBe(403);
    await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "nobody@example.com", password: "whatever-it-is" } }));
    const failures = await prisma.auditLog.findMany({ where: { action: "staff.sign_in_failed" }, orderBy: { createdAt: "asc" } });
    expect(failures.map((f) => [f.targetId, (f.details as { reason: string }).reason, f.staffName])).toEqual([
      [desk.id, "wrong_password", "Sign-in attempt"],
      [desk.id, "deactivated", "Sign-in attempt"],
    ]);
  });

  it("reactivating lets them back in", async () => {
    const owner = await as("OWNER");
    const desk = await createStaff("STAFF", { email: "back@example.com", password: "back-password-1" });
    await call(staffById.PUT, await put(owner, { active: false }), { id: desk.id });
    expect((await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "back@example.com", password: "back-password-1" } }))).status).toBe(403);
    await call(staffById.PUT, await put(owner, { active: true }), { id: desk.id });
    expect((await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "back@example.com", password: "back-password-1" } }))).status).toBe(200);
  });
});

describe("prices need prices.edit", () => {
  const ONLY_ADMINS = "Only admins can change prices.";

  it("plans.edit alone changes a plan's name and benefits, but not its price, interval or guest rate, and can't create plans", async () => {
    const editor = { staff: await createStaffWith(["plans.edit"]) };
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    expect((await call(planById.PUT, await put(editor, { name: "Unlimited Plus", guestPassesPerCycle: 3 }), { id: plan.id })).status).toBe(200);
    for (const body of [{ priceCents: plan.priceCents + 100 }, { interval: plan.interval === "WEEK" ? "MONTH" : "WEEK" }, { guestRateCents: plan.guestRateCents + 500 }]) {
      const res = await call(planById.PUT, await put(editor, body), { id: plan.id });
      expect(res.status).toBe(403);
      expect(res.body.error?.message).toBe(ONLY_ADMINS);
    }
    const create = await call(adminPlans.POST, await post(editor, { name: "Student", priceCents: 1500, interval: "WEEK", classCreditsPerCycle: null, guestPassesPerCycle: 0, shopDiscountPercent: 0, guestRateCents: 0 }));
    expect(create.status).toBe(403);
    const after = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: plan.id } });
    expect([after.name, after.priceCents, after.interval, after.guestRateCents]).toEqual(["Unlimited Plus", plan.priceCents, plan.interval, plan.guestRateCents]);
  });

  it("products.edit alone edits a product, but not its prices, and can't add a variant or a product", async () => {
    const owner = await as("OWNER");
    const created = await call(products.POST, await post(owner, { name: "Club tee", category: "APPAREL", variants: [{ sku: "TEE-M", priceCents: 3500, size: "M" }] }));
    expect(created.status).toBe(201);
    const variant = (created.body.variants as { id: string }[])[0];
    const editor = { staff: await createStaffWith(["products.edit", "orders.manage"]) };
    const base = { name: "Club tee", category: "APPAREL", variants: [{ id: variant.id, sku: "TEE-M", priceCents: 3500, size: "M" }] };
    expect((await call(productById.PUT, await put(editor, { ...base, description: "Soft cotton" }), { id: String(created.body.id) })).status).toBe(200);
    expect((await call(productById.PUT, await put(editor, { ...base, variants: [{ ...base.variants[0], priceCents: 2500 }] }), { id: String(created.body.id) })).status).toBe(403);
    expect((await call(productById.PUT, await put(editor, { ...base, variants: [...base.variants, { sku: "TEE-L", priceCents: 3500, size: "L" }] }), { id: String(created.body.id) })).status).toBe(403);
    expect((await call(products.POST, await post(editor, { name: "Cap", category: "APPAREL", variants: [{ sku: "CAP", priceCents: 2000 }] }))).status).toBe(403);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).priceCents).toBe(3500);
  });

  it("an admin changes a price, and the audit log keeps the old and new values", async () => {
    const admin = await as("ADMIN");
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    expect((await call(planById.PUT, await put(admin, { priceCents: plan.priceCents + 500 }), { id: plan.id })).status).toBe(200);
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "plan.price_changed", targetId: plan.id } });
    expect(entry.staffName).toBe((admin as { staff: { name: string } }).staff.name);
    expect(entry.before).toMatchObject({ priceCents: plan.priceCents });
    expect(entry.after).toMatchObject({ priceCents: plan.priceCents + 500 });
  });
});

describe("the audit log keeps who, when, and old and new values", () => {
  it("settings", async () => {
    const owner = await as("OWNER");
    await call(features.PUT, await put(owner, { requireKeycardForEntry: true }));
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: { startsWith: "settings." } } });
    expect(entry.before).toEqual({ requireKeycardForEntry: false });
    expect(entry.after).toEqual({ requireKeycardForEntry: true });
  });

  it("roles", async () => {
    const owner = await as("OWNER");
    await call(roleById.PUT, await put(owner, { permissions: ["members.view"] }), { id: "role_trainer" });
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "role.updated" } });
    expect(entry.before).toMatchObject({ name: "Trainer", permissions: [] });
    expect(entry.after).toMatchObject({ name: "Trainer", permissions: ["members.view"] });
  });

  it("staff accounts", async () => {
    const owner = await as("OWNER");
    const desk = await createStaff("STAFF");
    await call(staffById.PUT, await put(owner, { roleId: "role_manager" }), { id: desk.id });
    await call(staffById.PUT, await put(owner, { active: false }), { id: desk.id });
    const entries = await prisma.auditLog.findMany({ where: { targetId: desk.id }, orderBy: { createdAt: "asc" } });
    expect(entries.map((e) => [e.action, e.before, e.after])).toEqual([
      ["staff.role_changed", { name: desk.name, role: "Front desk", active: true }, { name: desk.name, role: "Manager", active: true }],
      ["staff.deactivated", { name: desk.name, role: "Manager", active: true }, { name: desk.name, role: "Manager", active: false }],
    ]);
  });

  it("refunds", async () => {
    const manager = await as("MANAGER");
    const m = await createMember();
    const payment = await prisma.payment.create({ data: { memberId: m.id, amount: 3995, gstCents: 363, status: "succeeded" } });
    expect((await call(refund.POST, await post(manager, { amountCents: 1000, reason: "Charged twice", method: "MANUAL" }), { id: payment.id })).status).toBeLessThan(300);
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "billing.refunded", targetId: payment.id } });
    expect(entry.before).toMatchObject({ refundedCents: 0 });
    expect(entry.after).toMatchObject({ refundedCents: 1000 });
  });
});

describe("members' private details", () => {
  it("staff who can't see emails can't search by email either", async () => {
    await createMember({ name: "Rory Quinn", email: "rory.private@example.com" });
    const search = async (who: As, q: string) => (await call(members.GET, await makeRequest("GET", `/api/members?q=${encodeURIComponent(q)}`, { as: who }))).body.items as { name: string }[];
    const desk = await as("STAFF");
    const manager = await as("MANAGER");
    expect(await search(desk, "rory.private")).toEqual([]);
    expect((await search(desk, "Rory")).map((m) => m.name)).toEqual(["Rory Quinn"]);
    expect((await search(manager, "rory.private")).map((m) => m.name)).toEqual(["Rory Quinn"]);
  });
});

describe("trainers see their own classes and only what those classes need (R-33)", () => {
  it("lists only the trainer's classes, with booked members' names but not their private details", async () => {
    const trainer = await createStaff("TRAINER");
    const other = await createStaff("TRAINER");
    const m = await createMember({ email: "booked@example.com" });
    const start = new Date(Date.now() + 86_400_000);
    const mine = await prisma.class.create({ data: { name: "Mine", startTime: start, trainerId: trainer.id, bookings: { create: { memberId: m.id } } } });
    await prisma.class.create({ data: { name: "Theirs", startTime: start, trainerId: other.id } });
    const res = await call(classes.GET, await makeRequest("GET", "/api/classes", { as: { staff: trainer } }));
    expect(res.status).toBe(200);
    const list = res.body as unknown as { id: string; name: string; bookings: { member: { name: string } }[] }[];
    expect(list.map((c) => c.name)).toEqual(["Mine"]);
    expect(list[0].id).toBe(mine.id);
    expect(list[0].bookings[0].member.name).toBe(m.name);
    expect(JSON.stringify(res.body)).not.toContain("booked@example.com");
    expect((await call(members.GET, await makeRequest("GET", "/api/members", { as: { staff: trainer } }))).status).toBe(403);
  });

  it("marks attendance for their own class only", async () => {
    const trainer = await createStaff("TRAINER");
    const other = await createStaff("TRAINER");
    const m = await createMember();
    const start = new Date(Date.now() - 3_600_000);
    const mine = await prisma.class.create({ data: { name: "Mine", startTime: start, trainerId: trainer.id, bookings: { create: { memberId: m.id } } } });
    const theirs = await prisma.class.create({ data: { name: "Theirs", startTime: start, trainerId: other.id, bookings: { create: { memberId: m.id } } } });
    const mark = async (classId: string) => call(classBook.PATCH, await makeRequest("PATCH", "/x", { as: { staff: trainer }, body: { memberId: m.id, status: "ATTENDED" } }), { id: classId });
    expect((await mark(mine.id)).status).toBe(200);
    expect((await mark(theirs.id)).status).toBe(403);
    expect((await prisma.classBooking.findFirstOrThrow({ where: { classId: theirs.id } })).status).toBe("BOOKED");
  });
});

describe("rollback safety", () => {
  it("keeps the old fixed role in step, never above the new one", async () => {
    const owner = await as("OWNER");
    const custom = await prisma.role.create({ data: { name: "Everything but owner", permissions: ["staff.manage", "finance.view"] } });
    const person = await createStaff("STAFF");
    const legacy = async () => (await prisma.staff.findUniqueOrThrow({ where: { id: person.id } })).role;
    for (const [roleId, expected] of [["role_admin", "MANAGER"], ["role_trainer", "TRAINER"], [custom.id, "FRONT_DESK"], ["role_owner", "OWNER"]] as const) {
      expect((await call(staffById.PUT, await put(owner, { roleId }), { id: person.id })).status).toBe(200);
      expect(await legacy()).toBe(expected);
    }
    const invited = await call(staffInvite.POST, await post(owner, { name: "Tia", email: "tia@example.com", roleId: "role_trainer" }));
    expect((await prisma.staff.findUniqueOrThrow({ where: { id: inviteOf(invited).staff.id } })).role).toBe("TRAINER");
  });
});
