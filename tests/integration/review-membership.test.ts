// Regression tests for membership, classes, check-in and dates items in
// docs/REVIEW.md. Each test is named after its review ID and failed before
// the fix.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as checkIn from "@/app/api/check-in/route";
import * as memberById from "@/app/api/members/[id]/route";
import * as members from "@/app/api/members/route";
import * as classById from "@/app/api/classes/[id]/route";
import * as staffBook from "@/app/api/classes/[id]/book/route";
import * as templateById from "@/app/api/class-templates/[id]/route";
import * as planById from "@/app/api/plans/[id]/route";
import * as shifts from "@/app/api/shifts/route";
import * as myClasses from "@/app/api/me/classes/route";
import * as myBooking from "@/app/api/me/classes/[id]/booking/route";
import * as myWaitlist from "@/app/api/me/classes/[id]/waitlist/route";
import * as myPause from "@/app/api/me/membership/pause/route";
import * as myCancel from "@/app/api/me/membership/cancel/route";
import * as myAnnouncements from "@/app/api/me/announcements/route";
import { applyDueTransitions, previewPlanChange } from "@/lib/membership/service";
import { getBenefitUsage } from "@/lib/membership/benefits";
import { generateClasses } from "@/lib/classes/timetable";
import { applyDataRetention, runSteps } from "@/lib/jobs/daily";
import { localDateIn, zonedTimeToUtc } from "@/lib/dates";
import { gym } from "@/lib/config";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { installFakeStripe } from "../fake-stripe";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const tz = gym.business.timezone;
let stripe: ReturnType<typeof installFakeStripe> | null = null;
let manager: As;
let desk: As;

beforeEach(async () => {
  await resetDb();
  manager = { staff: await createStaff("MANAGER") };
  desk = { staff: await createStaff("FRONT_DESK") };
});
afterEach(() => {
  stripe?.restore();
  stripe = null;
});

const asMember = (m: { id: string; name: string | null; email: string; sessionVersion: number }): As => ({ member: m });
const classAt = (msAhead: number, capacity = 10, extra: Record<string, unknown> = {}) =>
  prisma.class.create({ data: { name: "Strength", startTime: new Date(Date.now() + msAhead), capacity, durationMinutes: 45, ...extra } });
async function oldMember(overrides: Parameters<typeof createMember>[0] = {}) {
  const m = await createMember(overrides);
  return prisma.member.update({ where: { id: m.id }, data: { createdAt: new Date(Date.now() - 200 * DAY), membershipStartedAt: new Date(Date.now() - 200 * DAY) } });
}

describe("R-02 check-in for members who haven't paid", () => {
  it("refuses a member who signed up but hasn't started a plan", async () => {
    const m = await createMember({ status: "PENDING" });
    const res = await call(checkIn.POST, await makeRequest("POST", "/x", { as: desk, body: { query: m.id } }));
    expect(res.body).toMatchObject({ granted: false });
    expect(await prisma.checkIn.count({ where: { memberId: m.id } })).toBe(0);
  });
});

describe("R-03 a pause booked for later", () => {
  it("doesn't touch Stripe or access until the pause starts, then pauses Stripe billing", async () => {
    stripe = installFakeStripe();
    const m = await oldMember({ stripeSubscriptionId: "sub_later" });
    const from = localDateIn(tz, new Date(Date.now() + 10 * DAY));
    const until = localDateIn(tz, new Date(Date.now() + 24 * DAY));
    expect((await call(myPause.POST, await makeRequest("POST", "/x", { as: asMember(m), body: { from, until } }))).status).toBe(200);
    expect(stripe.calls.filter((c) => c.method === "subscriptions.update")).toHaveLength(0);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("ACTIVE");

    await applyDueTransitions(prisma, new Date(zonedTimeToUtc(from, "00:00", tz).getTime() + HOUR));
    const pauseCall = stripe.calls.find((c) => c.method === "subscriptions.update");
    expect(pauseCall?.args[1]).toMatchObject({ pause_collection: { behavior: "void" } });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("PAUSED");
  });
});

describe("R-04 class credits belong to the cycle of the class", () => {
  it("booking next cycle's classes doesn't use up this cycle's credits", async () => {
    // Standard plan: 2 classes per week. Stripe period ends in a day.
    const m = await createMember({ planSlug: "standard" });
    await prisma.member.update({ where: { id: m.id }, data: { currentPeriodStart: new Date(Date.now() - 6 * DAY), currentPeriodEnd: new Date(Date.now() + DAY) } });
    const nextA = await classAt(2 * DAY);
    const nextB = await classAt(2 * DAY + 2 * HOUR);
    const nextC = await classAt(3 * DAY);
    const soon = await classAt(12 * HOUR);
    expect((await call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: nextA.id })).status).toBe(201);
    expect((await call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: nextB.id })).status).toBe(201);
    expect((await getBenefitUsage(prisma, m.id)).classCredits.remaining).toBe(2);
    expect((await call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: nextC.id })).status).toBe(409);
    expect((await call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: soon.id })).status).toBe(201);
  });
});

describe("R-05 cancelling a class", () => {
  it("keeps the class as cancelled, returns credits, and the timetable doesn't bring it back", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const template = await prisma.classTemplate.create({ data: { name: "Conditioning", weekday: 0, startTime: "06:00", durationMinutes: 45, capacity: 10 } });
    await generateClasses(prisma, tz, 2);
    const cls = await prisma.class.findFirstOrThrow({ where: { templateId: template.id }, orderBy: { startTime: "asc" } });
    const m = await createMember({ planSlug: "standard" });
    await prisma.classBooking.create({ data: { classId: cls.id, memberId: m.id, usedCredit: true } });
    await prisma.benefitLedger.create({ data: { memberId: m.id, kind: "CLASS_CREDIT", delta: -1, reason: "Class booking", refType: "booking", refId: cls.id, effectiveAt: cls.startTime } });

    expect((await call(classById.DELETE, await makeRequest("DELETE", "/x", { as: owner }), { id: cls.id })).status).toBe(200);
    const after = await prisma.class.findUniqueOrThrow({ where: { id: cls.id } });
    expect(after.cancelledAt).not.toBeNull();
    expect(await prisma.classBooking.count({ where: { classId: cls.id } })).toBe(0);
    const ledger = await prisma.benefitLedger.findMany({ where: { memberId: m.id, refId: cls.id } });
    expect(ledger.reduce((s, e) => s + e.delta, 0)).toBe(0);

    await generateClasses(prisma, tz, 2);
    expect(await prisma.class.count({ where: { templateId: template.id, startTime: cls.startTime } })).toBe(1);
    const listed = await call(myClasses.GET, await makeRequest("GET", `/x?from=${encodeURIComponent(new Date(cls.startTime.getTime() - HOUR).toISOString())}`, { as: asMember(m) }));
    expect((listed.body.classes as { id: string }[]).some((c) => c.id === cls.id)).toBe(false);
    expect((await call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: cls.id })).status).toBe(409);
  });
});

describe("R-06 status and plan changes from the member edit form", () => {
  it("refuses status changes that have their own actions", async () => {
    const m = await createMember();
    for (const status of ["CANCELED", "PAUSED", "PAST_DUE"]) {
      const res = await call(memberById.PUT, await makeRequest("PUT", "/x", { as: manager, body: { status } }), { id: m.id });
      expect(res.status).toBe(422);
    }
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("ACTIVE");
  });

  it("starting a pending member's membership records when it started", async () => {
    const m = await createMember({ status: "PENDING" });
    const res = await call(memberById.PUT, await makeRequest("PUT", "/x", { as: manager, body: { status: "ACTIVE" } }), { id: m.id });
    expect(res.status).toBe(200);
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.membershipStartedAt).not.toBeNull();
  });

  it("a card-paying member's plan changes through Change plan, not the edit form", async () => {
    const m = await createMember({ stripeSubscriptionId: "sub_edit" });
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "standard" } });
    const res = await call(memberById.PUT, await makeRequest("PUT", "/x", { as: manager, body: { planId: plan.id } }), { id: m.id });
    expect(res.status).toBe(409);
  });

  it("changing a front-desk-billed member's plan clears any booked change", async () => {
    const m = await createMember();
    const standard = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "standard" } });
    const offPeak = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "off-peak" } });
    await prisma.member.update({ where: { id: m.id }, data: { pendingPlanId: offPeak.id } });
    await call(memberById.PUT, await makeRequest("PUT", "/x", { as: manager, body: { planId: standard.id } }), { id: m.id });
    expect(await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ planId: standard.id, pendingPlanId: null });
  });
});

describe("R-07 cooling-off counts from when the membership started", () => {
  it("gives the cooling-off period to someone who signed up weeks ago but started yesterday", async () => {
    installFakeStripe();
    const m = await createMember({ stripeSubscriptionId: "sub_cool" });
    await prisma.member.update({ where: { id: m.id }, data: { createdAt: new Date(Date.now() - 30 * DAY), membershipStartedAt: new Date(Date.now() - DAY) } });
    const res = await call(myCancel.POST, await makeRequest("POST", "/x", { as: asMember(m), body: {} }));
    expect(res.body.reason).toBe("cooling_off");
  });
});

describe("R-13 pause dates are the gym's local dates", () => {
  it("starts a pause at local midnight of the chosen date", async () => {
    const m = await oldMember();
    const from = localDateIn(tz, new Date(Date.now() + 3 * DAY));
    const until = localDateIn(tz, new Date(Date.now() + 17 * DAY));
    await call(myPause.POST, await makeRequest("POST", "/x", { as: asMember(m), body: { from, until } }));
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.pausedFrom?.toISOString()).toBe(zonedTimeToUtc(from, "00:00", tz).toISOString());
    expect(after.pausedUntil?.toISOString()).toBe(zonedTimeToUtc(until, "00:00", tz).toISOString());
  });
});

describe("R-27 pauses and cancellations together", () => {
  it("won't pause a membership that has a cancellation booked", async () => {
    installFakeStripe();
    const m = await oldMember();
    await call(myCancel.POST, await makeRequest("POST", "/x", { as: asMember(m), body: {} }));
    const res = await call(myPause.POST, await makeRequest("POST", "/x", { as: asMember(m), body: { from: localDateIn(tz), until: localDateIn(tz, new Date(Date.now() + 14 * DAY)) } }));
    expect(res.status).toBe(409);
  });

  it("a scheduled cancellation during a pause clears the pause, so the member isn't 'resumed' later", async () => {
    const m = await oldMember();
    await prisma.member.update({ where: { id: m.id }, data: { status: "PAUSED", pausedFrom: new Date(Date.now() - 5 * DAY), pausedUntil: new Date(Date.now() + 20 * DAY), cancelAt: new Date(Date.now() - HOUR) } });
    await applyDueTransitions(prisma);
    expect(await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ status: "CANCELED", pausedFrom: null, pausedUntil: null });
    await applyDueTransitions(prisma, new Date(Date.now() + 30 * DAY));
    expect(await prisma.membershipEvent.count({ where: { memberId: m.id, type: "RESUMED" } })).toBe(0);
  });
});

describe("R-28 plan changes across billing intervals", () => {
  it("decides upgrade or downgrade by monthly cost, and leaves cross-interval proration to Stripe", () => {
    const member = { createdAt: new Date(Date.now() - 100 * DAY), currentPeriodStart: null, currentPeriodEnd: null, membershipPlan: { priceCents: 2995, interval: "WEEK" as const } };
    const toMonthly = previewPlanChange(member, { priceCents: 15000, interval: "MONTH" });
    expect(toMonthly.upgrade).toBe(true); // $29.95 a week is about $129.78 a month
    expect(toMonthly.prorationCents).toBeNull();
    const cheaperMonthly = previewPlanChange(member, { priceCents: 11000, interval: "MONTH" });
    expect(cheaperMonthly.upgrade).toBe(false);
  });
});

describe("R-31 two bookings racing for the last credit", () => {
  it("only one of them gets it", async () => {
    const m = await createMember({ planSlug: "standard" });
    await prisma.member.update({ where: { id: m.id }, data: { currentPeriodStart: new Date(Date.now() - DAY), currentPeriodEnd: new Date(Date.now() + 6 * DAY) } });
    const first = await classAt(HOUR * 5);
    await call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: first.id });
    const [a, b] = await Promise.all([classAt(HOUR * 6), classAt(HOUR * 7)]);
    const results = await Promise.all([a, b].map(async (c) => call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: c.id })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await getBenefitUsage(prisma, m.id)).classCredits.remaining).toBe(0);
  });
});

describe("R-32 editing a timetable slot", () => {
  it("doesn't create a second class on days already generated", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const t = await prisma.classTemplate.create({ data: { name: "HIIT", weekday: 2, startTime: "06:00", durationMinutes: 45, capacity: 10 } });
    await generateClasses(prisma, tz, 2);
    const before = await prisma.class.count({ where: { templateId: t.id } });
    await call(templateById.PUT, await makeRequest("PUT", "/x", { as: owner, body: { name: "HIIT", weekday: 2, startTime: "06:30", durationMinutes: 45, capacity: 10 } }), { id: t.id });
    await generateClasses(prisma, tz, 2);
    expect(await prisma.class.count({ where: { templateId: t.id } })).toBe(before);
  });

  it("refuses a trainer that doesn't exist with a field error, not a server error", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const t = await prisma.classTemplate.create({ data: { name: "HIIT", weekday: 2, startTime: "06:00", durationMinutes: 45, capacity: 10 } });
    const res = await call(templateById.PUT, await makeRequest("PUT", "/x", { as: owner, body: { name: "HIIT", trainerId: "nobody", weekday: 2, startTime: "06:00", durationMinutes: 45, capacity: 10 } }), { id: t.id });
    expect(res.status).toBe(422);
  });
});

describe("R-35 daily jobs", () => {
  it("one failing step doesn't stop the others", async () => {
    const ran: string[] = [];
    const result = await runSteps({
      first: async () => {
        throw new Error("boom");
      },
      second: async () => {
        ran.push("second");
        return { done: 1 };
      },
    });
    expect(ran).toEqual(["second"]);
    expect(result).toMatchObject({ failed: ["first"], second: { done: 1 } });
  });
});

describe("R-36 members added by staff", () => {
  it("front desk can add a member, but they start without access until billing is set up", async () => {
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    const res = await call(members.POST, await makeRequest("POST", "/x", { as: desk, body: { name: "Walk In", email: "walkin@example.com", planId: plan.id } }));
    expect(res.status).toBe(201);
    expect((await prisma.member.findUniqueOrThrow({ where: { email: "walkin@example.com" } })).status).toBe("PENDING");
  });

  it("a manager can add a member who pays at the desk and start them straight away", async () => {
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    await call(members.POST, await makeRequest("POST", "/x", { as: manager, body: { name: "Cash Payer", email: "cash@example.com", planId: plan.id } }));
    const m = await prisma.member.findUniqueOrThrow({ where: { email: "cash@example.com" } });
    expect(m.status).toBe("ACTIVE");
    expect(m.membershipStartedAt).not.toBeNull();
  });
});

describe("R-38 changing a plan's billing interval", () => {
  it("is refused while members are on the plan", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const m = await createMember({ planSlug: "standard" });
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: m.planId! } });
    const res = await call(planById.PUT, await makeRequest("PUT", "/x", { as: owner, body: { interval: "MONTH" } }), { id: plan.id });
    expect(res.status).toBe(409);
  });
});

describe("R-39 archiving a member with bookings", () => {
  it("moves the next person up from the waitlist", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const cls = await classAt(DAY, 1);
    const leaving = await createMember();
    const waiting = await createMember();
    await prisma.classBooking.create({ data: { classId: cls.id, memberId: leaving.id } });
    await prisma.classWaitlist.create({ data: { classId: cls.id, memberId: waiting.id } });
    expect((await call(memberById.DELETE, await makeRequest("DELETE", "/x", { as: owner }), { id: leaving.id })).status).toBe(200);
    expect(await prisma.classBooking.findFirst({ where: { classId: cls.id, memberId: waiting.id } })).not.toBeNull();
  });
});

describe("R-44 members-only announcements", () => {
  it("aren't shown to people who haven't paid or have left", async () => {
    await prisma.announcement.create({ data: { title: "New door code", body: "It's 1234.", audience: "ALL_ACTIVE", publishedAt: new Date(Date.now() - HOUR) } });
    const pending = await createMember({ status: "PENDING" });
    const cancelled = await createMember({ status: "CANCELED" });
    const active = await createMember();
    expect((await call(myAnnouncements.GET, await makeRequest("GET", "/x", { as: asMember(pending) }))).body).toEqual([]);
    expect((await call(myAnnouncements.GET, await makeRequest("GET", "/x", { as: asMember(cancelled) }))).body).toEqual([]);
    expect(((await call(myAnnouncements.GET, await makeRequest("GET", "/x", { as: asMember(active) }))).body as unknown as unknown[]).length).toBe(1);
  });
});

describe("R-46 visit history in the audit log", () => {
  it("is deleted on the same schedule as check-ins", async () => {
    const m = await createMember();
    const old = new Date(Date.now() - 800 * DAY);
    await prisma.auditLog.create({ data: { staffName: "Desk", action: "member.checked_in", targetType: "Member", targetId: m.id, createdAt: old } });
    await prisma.auditLog.create({ data: { staffName: "Desk", action: "member.checked_in", targetType: "Member", targetId: m.id } });
    await applyDataRetention(prisma);
    expect(await prisma.auditLog.count({ where: { action: "member.checked_in" } })).toBe(1);
  });
});

describe("R-63 keycards", () => {
  it("front desk can record that a keycard was issued", async () => {
    const m = await createMember();
    const res = await call(memberById.PUT, await makeRequest("PUT", "/x", { as: desk, body: { keycardIssued: true } }), { id: m.id });
    expect(res.status).toBe(200);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).keycardIssued).toBe(true);
  });
});

describe("R-85 the roster", () => {
  it("shows a shift that's in progress", async () => {
    const trainer = await createStaff("TRAINER");
    await prisma.shift.create({ data: { staffId: trainer.id, startTime: new Date(Date.now() - 2 * HOUR), endTime: new Date(Date.now() + 4 * HOUR) } });
    const res = await call(shifts.GET, await makeRequest("GET", "/x", { as: manager }));
    expect((res.body as unknown as unknown[]).length).toBe(1);
  });
});

describe("R-86 booking checks", () => {
  it("members can't book a class that has started", async () => {
    const m = await createMember();
    const started = await classAt(-10 * 60 * 1000);
    expect((await call(myBooking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: started.id })).status).toBe(409);
  });

  it("members can't join a waitlist before booking opens", async () => {
    const m = await createMember();
    const later = await classAt(10 * DAY, 1);
    const other = await createMember();
    await prisma.classBooking.create({ data: { classId: later.id, memberId: other.id } });
    expect((await call(myWaitlist.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: later.id })).status).toBe(409);
  });

  it("staff can't book a cancelled or pending member, except as a casual visit", async () => {
    const cls = await classAt(DAY);
    const cancelled = await createMember({ status: "CANCELED" });
    expect((await call(staffBook.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: cancelled.id } }), { id: cls.id })).status).toBe(409);
    expect((await call(staffBook.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: cancelled.id, casual: true } }), { id: cls.id })).status).toBe(201);
  });
});

describe("R-87 a booked plan change with no history entry", () => {
  it("waits for the end of the billing cycle instead of applying at once", async () => {
    const m = await createMember({ planSlug: "unlimited" });
    const offPeak = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "off-peak" } });
    await prisma.member.update({ where: { id: m.id }, data: { pendingPlanId: offPeak.id, currentPeriodStart: new Date(Date.now() - DAY), currentPeriodEnd: new Date(Date.now() + 6 * DAY) } });
    await applyDueTransitions(prisma);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).pendingPlanId).toBe(offPeak.id);
    await applyDueTransitions(prisma, new Date(Date.now() + 7 * DAY));
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).planId).toBe(offPeak.id);
  });
});

describe("R-16 announcement emails", () => {
  it("two publish requests at once email each member once", async () => {
    const { captureEmailsForTests, capturedEmails } = await import("@/lib/email");
    const publish = await import("@/app/api/announcements/[id]/publish/route");
    captureEmailsForTests(true);
    const owner = { staff: await createStaff("OWNER") };
    await createMember({ email: "reader@example.com" });
    const a = await prisma.announcement.create({ data: { title: "Holiday hours", body: "Closed Monday.", audience: "ALL_ACTIVE" } });
    await Promise.all([1, 2].map(async () => call(publish.POST, await makeRequest("POST", "/x", { as: owner, body: { email: true } }), { id: a.id })));
    expect(capturedEmails().filter((e) => e.to === "reader@example.com")).toHaveLength(1);
    captureEmailsForTests(false);
  });
});
