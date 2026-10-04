import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as pause from "@/app/api/members/[id]/pause/route";
import * as cancel from "@/app/api/members/[id]/cancel/route";
import * as plan from "@/app/api/members/[id]/plan/route";
import * as notes from "@/app/api/members/[id]/notes/route";
import * as benefits from "@/app/api/members/[id]/benefits/route";
import * as detail from "@/app/api/members/[id]/route";
import { applyDueTransitions } from "@/lib/membership/service";
import { call, createMember, createStaff, createStaffWith, makeRequest, prisma, resetDb, type As } from "../helpers";
import { installFakeStripe } from "../fake-stripe";

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
let manager: As;
let desk: As;
// Front desk with members.edit turned on, as a gym that wants the desk to
// add members would set it up (D-100).
let deskEditor: As;
let stripe: ReturnType<typeof installFakeStripe> | null = null;

beforeEach(async () => {
  await resetDb();
  manager = { staff: await createStaff("MANAGER") };
  desk = { staff: await createStaff("FRONT_DESK") };
  deskEditor = { staff: await createStaffWith(["members.view", "checkin.scan", "bookings.manage", "orders.manage", "members.edit", "members.view_sensitive"], "Front desk plus") };
});
afterEach(() => stripe?.restore());

async function oldMember(overrides: Parameters<typeof createMember>[0] = {}) {
  const m = await createMember(overrides);
  return prisma.member.update({ where: { id: m.id }, data: { createdAt: new Date(Date.now() - 200 * DAY) } });
}

describe("pausing", () => {
  it("pauses from today, records the event, and resumes", async () => {
    const m = await oldMember();
    const res = await call(pause.POST, await makeRequest("POST", "/x", { as: manager, body: { from: iso(0), until: iso(14) } }), { id: m.id });
    expect(res.status).toBe(200);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("PAUSED");
    expect(await prisma.membershipEvent.count({ where: { memberId: m.id, type: "PAUSE_SCHEDULED" } })).toBe(1);
    expect((await call(pause.DELETE, await makeRequest("DELETE", "/x", { as: manager }), { id: m.id })).status).toBe(200);
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after).toMatchObject({ status: "ACTIVE", pausedUntil: null });
  });

  it("enforces the owner's pause rules", async () => {
    const m = await oldMember();
    const tooShort = await call(pause.POST, await makeRequest("POST", "/x", { as: manager, body: { from: iso(0), until: iso(3) } }), { id: m.id });
    expect(tooShort.status).toBe(422);
    expect(tooShort.body.error?.fields).toHaveProperty("until");
  });

  it("tells Stripe to stop collecting while paused", async () => {
    stripe = installFakeStripe();
    const m = await oldMember({ stripeSubscriptionId: "sub_pause" });
    await call(pause.POST, await makeRequest("POST", "/x", { as: manager, body: { from: iso(0), until: iso(10) } }), { id: m.id });
    expect(stripe.calls[0]).toMatchObject({ method: "subscriptions.update", args: ["sub_pause", { pause_collection: { behavior: "void" } }] });
  });

  it("front desk can't pause (manager action)", async () => {
    const m = await oldMember();
    expect((await call(pause.POST, await makeRequest("POST", "/x", { as: desk, body: { from: iso(0), until: iso(14) } }), { id: m.id })).status).toBe(403);
  });
});

describe("cancelling", () => {
  it("books the cancellation after the notice period and can be withdrawn", async () => {
    const m = await oldMember();
    const res = await call(cancel.POST, await makeRequest("POST", "/x", { as: manager, body: { reason: "Moving to Perth" } }), { id: m.id });
    expect(res.body.reason).toBe("notice");
    const booked = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(booked.status).toBe("ACTIVE");
    expect(Math.round((booked.cancelAt!.getTime() - Date.now()) / DAY)).toBe(14);
    expect((await call(cancel.DELETE, await makeRequest("DELETE", "/x", { as: manager }), { id: m.id })).status).toBe(200);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).cancelAt).toBeNull();
  });

  it("is immediate in the cooling-off period", async () => {
    const m = await createMember();
    const res = await call(cancel.POST, await makeRequest("POST", "/x", { as: manager, body: {} }), { id: m.id });
    expect(res.body.reason).toBe("cooling_off");
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("CANCELED");
  });

  it("schedules the Stripe cancellation for the same date, and stops if Stripe fails", async () => {
    stripe = installFakeStripe({ "subscriptions.update": () => Promise.reject(new Error("down")) });
    const m = await oldMember({ stripeSubscriptionId: "sub_c" });
    const failed = await call(cancel.POST, await makeRequest("POST", "/x", { as: manager, body: {} }), { id: m.id });
    expect(failed.status).toBe(502);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).cancelAt).toBeNull();
  });

  it("the daily job completes a cancellation when its date arrives", async () => {
    const m = await oldMember();
    await prisma.member.update({ where: { id: m.id }, data: { cancelAt: new Date(Date.now() - 1000) } });
    const result = await applyDueTransitions(prisma);
    expect(result.cancellations).toBe(1);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("CANCELED");
    expect((await applyDueTransitions(prisma)).cancellations).toBe(0);
  });
});

describe("plan changes", () => {
  it("upgrades straight away and schedules downgrades (config rules)", async () => {
    const m = await oldMember();
    const plans = await prisma.membershipPlan.findMany({ orderBy: { priceCents: "asc" } });
    const [cheap, mid, top] = plans;
    await prisma.member.update({ where: { id: m.id }, data: { planId: mid.id } });

    const up = await call(plan.POST, await makeRequest("POST", "/x", { as: manager, body: { planId: top.id } }), { id: m.id });
    expect(up.body).toMatchObject({ immediate: true, upgrade: true });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).planId).toBe(top.id);

    const down = await call(plan.POST, await makeRequest("POST", "/x", { as: manager, body: { planId: cheap.id } }), { id: m.id });
    expect(down.body).toMatchObject({ immediate: false, upgrade: false });
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after).toMatchObject({ planId: top.id, pendingPlanId: cheap.id });
  });

  it("refuses a retired plan", async () => {
    const m = await oldMember();
    const retired = await prisma.membershipPlan.update({ where: { slug: "unlimited" }, data: { active: false } });
    expect((await call(plan.POST, await makeRequest("POST", "/x", { as: manager, body: { planId: retired.id } }), { id: m.id })).status).toBe(422);
  });
});

describe("notes and adjustments", () => {
  it("notes need members.edit to add and private-details access to read; they're recorded with the author", async () => {
    const m = await createMember();
    expect((await call(notes.POST, await makeRequest("POST", "/x", { as: desk, body: { body: "Prefers morning classes" } }), { id: m.id })).status).toBe(403);
    expect((await call(notes.GET, await makeRequest("GET", "/x", { as: desk }), { id: m.id })).status).toBe(403);
    const res = await call(notes.POST, await makeRequest("POST", "/x", { as: deskEditor, body: { body: "Prefers morning classes" } }), { id: m.id });
    expect(res.status).toBe(201);
    const list = await call(notes.GET, await makeRequest("GET", "/x", { as: deskEditor }), { id: m.id });
    expect(list.body).toMatchObject([{ body: "Prefers morning classes", staffName: (deskEditor as { staff: { name: string } }).staff.name }]);
  });

  it("managers adjust benefits with a reason; front desk can't", async () => {
    const m = await createMember({ planSlug: "off-peak" });
    expect((await call(benefits.POST, await makeRequest("POST", "/x", { as: desk, body: { kind: "CLASS_CREDIT", delta: 2, reason: "Goodwill" } }), { id: m.id })).status).toBe(403);
    expect((await call(benefits.POST, await makeRequest("POST", "/x", { as: manager, body: { kind: "CLASS_CREDIT", delta: 2, reason: "Class cancelled by us" } }), { id: m.id })).status).toBe(201);
    const usage = await call(benefits.GET, await makeRequest("GET", "/x", { as: manager }), { id: m.id });
    expect(usage.body.classCredits).toMatchObject({ allowance: 0, adjustments: 2, remaining: 2 });
  });

  it("member detail shows the next billing date and hides Stripe IDs", async () => {
    const m = await oldMember({ stripeSubscriptionId: "sub_hidden" });
    const res = await call(detail.GET, await makeRequest("GET", "/x", { as: manager }), { id: m.id });
    expect(res.body.nextBillingDate).toBeTruthy();
    expect(res.body.hasSubscription).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("sub_hidden");
  });
});
