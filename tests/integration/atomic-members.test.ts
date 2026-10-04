// R-98: a change and its audit entry are written together or not at all,
// and so are the related changes one request makes. The audit write is made
// to fail (every entry, or only one action); nothing may be left behind.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const failAudit = vi.hoisted(() => ({ on: false, action: null as string | null }));
vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...actual,
    logAction: async (...args: Parameters<typeof actual.logAction>) => {
      if (failAudit.on || failAudit.action === args[2].action) throw new Error("audit write failed");
      return actual.logAction(...args);
    },
  };
});

const members = await import("@/app/api/members/route");
const memberById = await import("@/app/api/members/[id]/route");
const benefits = await import("@/app/api/members/[id]/benefits/route");
const notes = await import("@/app/api/members/[id]/notes/route");
const staffPass = await import("@/app/api/members/[id]/pass/route");
const checkIn = await import("@/app/api/check-in/route");
const iot = await import("@/app/api/iot/checkin/route");
const me = await import("@/app/api/me/route");
const terms = await import("@/app/api/me/terms/route");
const account = await import("@/app/api/me/account/route");
const password = await import("@/app/api/me/password/route");
const myPause = await import("@/app/api/me/membership/pause/route");
const myPlan = await import("@/app/api/me/membership/plan/route");
const myCancel = await import("@/app/api/me/membership/cancel/route");
const { installFakeStripe } = await import("../fake-stripe");
const { call, createMember, createStaff, makeRequest, prisma, resetDb } = await import("../helpers");

const DAY = 86_400_000;
let stripe: ReturnType<typeof installFakeStripe> | null = null;

beforeEach(async () => {
  await resetDb();
  stripe = null;
});
afterEach(() => {
  failAudit.on = false;
  failAudit.action = null;
  stripe?.restore();
});

const owner = async () => ({ staff: await createStaff("OWNER") });
const asMember = (m: { id: string; name: string | null; email: string; sessionVersion: number }) => ({ member: m });
const memberRow = (id: string) => prisma.member.findUniqueOrThrow({ where: { id } });
const oldMember = async (overrides: Parameters<typeof createMember>[0] = {}) => {
  const m = await createMember(overrides);
  return prisma.member.update({ where: { id: m.id }, data: { createdAt: new Date(Date.now() - 200 * DAY) } });
};

describe("R-98 staff member routes", () => {
  it("adding a member and starting their membership happen together", async () => {
    const as = await owner();
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "standard" } });
    failAudit.on = true;
    expect((await call(members.POST, await makeRequest("POST", "/x", { as, body: { name: "Ava", email: "ava@example.com" } }))).status).toBe(500);
    failAudit.on = false;
    failAudit.action = "membership.started";
    expect((await call(members.POST, await makeRequest("POST", "/x", { as, body: { name: "Bo", email: "bo@example.com", planId: plan.id } }))).status).toBe(500);
    expect(await prisma.member.count()).toBe(0);
  });

  it("editing details rolls back with a status or plan change made in the same request", async () => {
    const as = await owner();
    const pending = await createMember({ status: "PENDING", name: "Before" });
    failAudit.action = "member.updated";
    expect((await call(memberById.PUT, await makeRequest("PUT", "/x", { as, body: { status: "ACTIVE", name: "After" } }), { id: pending.id })).status).toBe(500);
    expect(await memberRow(pending.id)).toMatchObject({ status: "PENDING", name: "Before", membershipStartedAt: null });

    const desk = await createMember({ name: "Desk" });
    const standard = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "standard" } });
    expect((await call(memberById.PUT, await makeRequest("PUT", "/x", { as, body: { planId: standard.id, notes: "Moved plans" } }), { id: desk.id })).status).toBe(500);
    expect(await memberRow(desk.id)).toMatchObject({ planId: desk.planId, notes: null });

    failAudit.action = null;
    failAudit.on = true;
    expect((await call(memberById.PUT, await makeRequest("PUT", "/x", { as, body: { name: "Renamed" } }), { id: desk.id })).status).toBe(500);
    expect((await memberRow(desk.id)).name).toBe("Desk");
    expect(await prisma.membershipEvent.count()).toBe(0);
  });

  it("archiving rolls back", async () => {
    const as = await owner();
    const m = await createMember();
    failAudit.on = true;
    expect((await call(memberById.DELETE, await makeRequest("DELETE", "/x", { as }), { id: m.id })).status).toBe(500);
    expect(await memberRow(m.id)).toMatchObject({ archivedAt: null, status: "ACTIVE" });
  });

  it("benefit adjustments, notes and pass reissues roll back", async () => {
    const as = await owner();
    const m = await createMember();
    failAudit.on = true;
    expect((await call(benefits.POST, await makeRequest("POST", "/x", { as, body: { kind: "GUEST_PASS", delta: 1, reason: "Goodwill" } }), { id: m.id })).status).toBe(500);
    expect((await call(notes.POST, await makeRequest("POST", "/x", { as, body: { body: "Prefers mornings" } }), { id: m.id })).status).toBe(500);
    expect((await call(staffPass.POST, await makeRequest("POST", "/x", { as }), { id: m.id })).status).toBe(500);
    expect(await prisma.benefitLedger.count()).toBe(0);
    expect(await prisma.memberNote.count()).toBe(0);
    expect((await memberRow(m.id)).qrVersion).toBe(m.qrVersion);
  });
});

describe("R-98 check-in", () => {
  it("a front-desk or door check-in rolls back", async () => {
    const as = await owner();
    const m = await createMember();
    failAudit.on = true;
    expect((await call(checkIn.POST, await makeRequest("POST", "/x", { as, body: { query: m.email } }))).status).toBe(500);
    const door = new Request("http://localhost/api/iot/checkin", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.IOT_GATEWAY_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ memberId: m.id }),
    });
    expect((await call(iot.POST, door)).status).toBe(500);
    expect(await prisma.checkIn.count()).toBe(0);
    expect((await memberRow(m.id)).lastCheckIn).toBeNull();
  });
});

describe("R-98 member self-service", () => {
  it("profile changes, password changes and accepting terms roll back", async () => {
    const m = await createMember({ name: "Original", password: "old-password-123" });
    const as = asMember(m);
    failAudit.on = true;
    expect((await call(me.PATCH, await makeRequest("PATCH", "/x", { as, body: { name: "Changed" } }))).status).toBe(500);
    expect((await call(password.POST, await makeRequest("POST", "/x", { as, body: { current: "old-password-123", next: "new-password-456" } }))).status).toBe(500);
    expect((await call(terms.POST, await makeRequest("POST", "/x", { as }))).status).toBe(500);
    expect(await memberRow(m.id)).toMatchObject({ name: "Original", passwordHash: m.passwordHash, sessionVersion: m.sessionVersion });
    expect(await prisma.legalAcceptance.count()).toBe(0);
  });

  it("deleting an account rolls back", async () => {
    const m = await createMember({ name: "Keep Me", password: "member-password", status: "CANCELED" });
    failAudit.on = true;
    const res = await call(account.DELETE, await makeRequest("DELETE", "/x", { as: asMember(m), body: { password: "member-password", confirm: "DELETE" } }));
    expect(res.status).toBe(500);
    expect(await memberRow(m.id)).toMatchObject({ name: "Keep Me", anonymisedAt: null });
  });

  it("pausing, resuming, cancelling, withdrawing and changing plan roll back", async () => {
    stripe = installFakeStripe();
    const m = await oldMember({ planSlug: "standard", stripeSubscriptionId: "sub_atomic" });
    const as = asMember(m);
    const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString();
    const unlimited = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    failAudit.on = true;
    expect((await call(myPause.POST, await makeRequest("POST", "/x", { as, body: { from: iso(0), until: iso(14) } }))).status).toBe(500);
    expect((await call(myCancel.POST, await makeRequest("POST", "/x", { as, body: { reason: "Moving" } }))).status).toBe(500);
    expect((await call(myPlan.POST, await makeRequest("POST", "/x", { as, body: { planId: unlimited.id } }))).status).toBe(500);
    expect(await memberRow(m.id)).toMatchObject({ status: "ACTIVE", pausedUntil: null, cancelAt: null, planId: m.planId, pendingPlanId: null });

    await prisma.member.update({ where: { id: m.id }, data: { status: "PAUSED", pausedFrom: new Date(), pausedUntil: new Date(Date.now() + 14 * DAY) } });
    expect((await call(myPause.DELETE, await makeRequest("DELETE", "/x", { as }))).status).toBe(500);
    expect((await memberRow(m.id)).status).toBe("PAUSED");

    await prisma.member.update({ where: { id: m.id }, data: { status: "ACTIVE", pausedFrom: null, pausedUntil: null, cancelAt: new Date(Date.now() + 14 * DAY) } });
    expect((await call(myCancel.DELETE, await makeRequest("DELETE", "/x", { as }))).status).toBe(500);
    expect((await memberRow(m.id)).cancelAt).not.toBeNull();
    expect(await prisma.membershipEvent.count()).toBe(0);
  });
});
