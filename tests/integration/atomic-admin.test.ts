// R-98: a change and its audit entry are written together or not at all.
// The audit write is made to fail; the change must not be left behind.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const failAudit = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...actual,
    logAction: async (...args: Parameters<typeof actual.logAction>) => {
      if (failAudit.on) throw new Error("audit write failed");
      return actual.logAction(...args);
    },
  };
});

const adminPlans = await import("@/app/api/admin/plans/route");
const planItem = await import("@/app/api/plans/[id]/route");
const announcements = await import("@/app/api/announcements/route");
const announcementItem = await import("@/app/api/announcements/[id]/route");
const publish = await import("@/app/api/announcements/[id]/publish/route");
const features = await import("@/app/api/settings/features/route");
const staffList = await import("@/app/api/staff/route");
const staffItem = await import("@/app/api/staff/[id]/route");
const staffPassword = await import("@/app/api/staff/me/password/route");
const bootstrap = await import("@/app/api/auth/bootstrap/route");
const { call, createStaff, makeRequest, prisma, resetDb } = await import("../helpers");

beforeEach(resetDb);
afterEach(() => {
  failAudit.on = false;
});

describe("R-98 plans", () => {
  it("creating and editing a plan roll back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const body = { name: "Early Bird", priceCents: 1500, interval: "WEEK", classCreditsPerCycle: null, guestPassesPerCycle: 0, shopDiscountPercent: 0, guestRateCents: 0 };
    const created = await call(adminPlans.POST, await makeRequest("POST", "/x", { as: owner, body }));
    const id = created.body.id as string;

    failAudit.on = true;
    expect((await call(adminPlans.POST, await makeRequest("POST", "/x", { as: owner, body: { ...body, name: "Late Night" } }))).status).toBe(500);
    expect((await call(planItem.PUT, await makeRequest("PUT", "/x", { as: owner, body: { priceCents: 9900, active: false } }), { id })).status).toBe(500);

    expect(await prisma.membershipPlan.findUnique({ where: { slug: "late-night" } })).toBeNull();
    expect(await prisma.membershipPlan.findUniqueOrThrow({ where: { id }, select: { priceCents: true, active: true } })).toEqual({ priceCents: 1500, active: true });
  });
});

describe("R-98 announcements", () => {
  it("creating, editing, publishing and deleting roll back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const body = { title: "Holiday hours", body: "Closed on Monday." };
    const created = await call(announcements.POST, await makeRequest("POST", "/x", { as: owner, body }));
    const id = created.body.id as string;

    failAudit.on = true;
    expect((await call(announcements.POST, await makeRequest("POST", "/x", { as: owner, body: { ...body, title: "New towels" } }))).status).toBe(500);
    expect((await call(announcementItem.PUT, await makeRequest("PUT", "/x", { as: owner, body: { ...body, title: "Changed" } }), { id })).status).toBe(500);
    expect((await call(publish.POST, await makeRequest("POST", "/x", { as: owner, body: { email: false } }), { id })).status).toBe(500);
    expect((await call(announcementItem.DELETE, await makeRequest("DELETE", "/x", { as: owner }), { id })).status).toBe(500);

    expect(await prisma.announcement.findMany({ select: { title: true, publishedAt: true } })).toEqual([{ title: "Holiday hours", publishedAt: null }]);
  });
});

describe("R-98 settings", () => {
  it("changing a feature switch rolls back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    failAudit.on = true;
    expect((await call(features.PUT, await makeRequest("PUT", "/x", { as: owner, body: { hideRevenueFromFrontDesk: true } }))).status).toBe(500);
    expect(await prisma.gymSettings.findUnique({ where: { id: "singleton" } })).toBeNull();
  });
});

describe("R-98 staff", () => {
  it("adding, editing and removing staff roll back when the audit entry fails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const target = await createStaff("FRONT_DESK");

    failAudit.on = true;
    const newStaff = { name: "New Hire", email: "new-hire@example.com", password: "correct-horse-battery", role: "TRAINER" };
    expect((await call(staffList.POST, await makeRequest("POST", "/x", { as: owner, body: newStaff }))).status).toBe(500);
    expect((await call(staffItem.PUT, await makeRequest("PUT", "/x", { as: owner, body: { role: "MANAGER", password: "another-long-password" } }), { id: target.id })).status).toBe(500);
    expect((await call(staffItem.DELETE, await makeRequest("DELETE", "/x", { as: owner }), { id: target.id })).status).toBe(500);

    expect(await prisma.staff.findUnique({ where: { email: newStaff.email } })).toBeNull();
    expect(await prisma.staff.findUniqueOrThrow({ where: { id: target.id }, select: { role: true, passwordHash: true, sessionVersion: true } })).toEqual({
      role: "FRONT_DESK",
      passwordHash: target.passwordHash,
      sessionVersion: target.sessionVersion,
    });
  });

  it("changing your own password rolls back when the audit entry fails", async () => {
    const me = await createStaff("TRAINER");
    failAudit.on = true;
    const body = { currentPassword: "correct-horse-battery", newPassword: "a-brand-new-password" };
    expect((await call(staffPassword.POST, await makeRequest("POST", "/x", { as: { staff: me }, body }))).status).toBe(500);
    expect(await prisma.staff.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true, sessionVersion: true } })).toEqual({
      passwordHash: me.passwordHash,
      sessionVersion: me.sessionVersion,
    });
  });

  it("first-run setup rolls back when the audit entry fails", async () => {
    failAudit.on = true;
    const body = { name: "First Owner", email: "owner@example.com", password: "correct-horse-battery" };
    expect((await call(bootstrap.POST, await makeRequest("POST", "/x", { body }))).status).toBe(500);
    expect(await prisma.staff.count()).toBe(0);
  });
});
