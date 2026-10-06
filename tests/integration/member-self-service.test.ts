import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as signup from "@/app/api/auth/member-signup/route";
import * as memberLogin from "@/app/api/auth/member-login/route";
import * as me from "@/app/api/me/route";
import * as terms from "@/app/api/me/terms/route";
import * as onboarding from "@/app/api/me/onboarding/route";
import * as membership from "@/app/api/me/membership/route";
import * as myPlan from "@/app/api/me/membership/plan/route";
import * as myPause from "@/app/api/me/membership/pause/route";
import * as myCancel from "@/app/api/me/membership/cancel/route";
import * as myClasses from "@/app/api/me/classes/route";
import * as booking from "@/app/api/me/classes/[id]/booking/route";
import * as waitlist from "@/app/api/me/classes/[id]/waitlist/route";
import * as pass from "@/app/api/me/pass/route";
import * as password from "@/app/api/me/password/route";
import * as exportData from "@/app/api/me/export/route";
import * as account from "@/app/api/me/account/route";
import * as myInvoice from "@/app/api/me/payments/[id]/invoice/route";
import * as checkout from "@/app/api/checkout/route";
import { readPassToken } from "@/lib/checkin/qr";
import { cancelBooking } from "@/lib/classes/service";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { installFakeStripe } from "../fake-stripe";

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
let stripe: ReturnType<typeof installFakeStripe> | null = null;

beforeEach(async () => {
  await resetDb();
  stripe = null;
});
afterEach(() => {
  stripe?.restore();
  captureEmailsForTests(false);
});

const asMember = (m: { id: string; name: string | null; email: string; sessionVersion: number }): As => ({ member: m });

async function oldMember(overrides: Parameters<typeof createMember>[0] = {}) {
  const m = await createMember(overrides);
  return prisma.member.update({ where: { id: m.id }, data: { createdAt: new Date(Date.now() - 200 * DAY) } });
}

async function classAt(hoursAhead: number, capacity = 10) {
  return prisma.class.create({ data: { name: "Strength", startTime: new Date(Date.now() + hoursAhead * 3_600_000), capacity, durationMinutes: 45 } });
}

describe("sign-up", () => {
  const body = { name: "Mia Nguyen", email: "mia@example.com", password: "a-long-password", acceptTerms: true };

  it("creates a member with no plan or access, signs them in, and records what they accepted", async () => {
    const res = await call(signup.POST, await makeRequest("POST", "/api/auth/member-signup", { body }));
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    const m = await prisma.member.findUniqueOrThrow({ where: { email: "mia@example.com" } });
    expect(m).toMatchObject({ status: "PENDING", planId: null, onboardedAt: null });
    expect(m.passwordHash).not.toContain("a-long-password");
    const accepted = await prisma.legalAcceptance.findMany({ where: { memberId: m.id }, orderBy: { document: "asc" } });
    expect(accepted.map((a) => [a.document, a.version, a.context])).toEqual([
      ["TERMS", "2026-10-draft", "signup"],
      ["PRIVACY", "2026-10-draft", "signup"],
    ]);
    expect(await prisma.auditLog.count({ where: { action: "member.signed_up", targetId: m.id } })).toBe(1);
  });

  it("needs the terms accepted and a 10-character password", async () => {
    const noTerms = await call(signup.POST, await makeRequest("POST", "/x", { body: { ...body, acceptTerms: false } }));
    expect(noTerms.status).toBe(422);
    expect(noTerms.body.error?.fields?.acceptTerms).toBeTruthy();
    const short = await call(signup.POST, await makeRequest("POST", "/x", { body: { ...body, password: "short" } }));
    expect(short.body.error?.fields?.password).toBeTruthy();
    expect(await prisma.member.count()).toBe(0);
  });

  it("won't take over an existing member's email, even one with no password", async () => {
    const existing = await createMember({ email: "taken@example.com" });
    const res = await call(signup.POST, await makeRequest("POST", "/x", { body: { ...body, email: "Taken@Example.com" } }));
    expect(res.status).toBe(409);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: existing.id } })).passwordHash).toBeNull();
    const login = await call(memberLogin.POST, await makeRequest("POST", "/x", { body: { email: "taken@example.com", password: body.password } }));
    expect(login.status).toBe(401);
  });

  it("a member who hasn't started a plan can't book, pause, cancel or switch plans, but can check out", async () => {
    const m = await createMember({ status: "PENDING" });
    await prisma.member.update({ where: { id: m.id }, data: { planId: null } });
    const as = asMember(m);
    const cls = await classAt(24);
    expect((await call(booking.POST, await makeRequest("POST", "/x", { as }), { id: cls.id })).status).toBe(409);
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "standard" } });
    expect((await call(myPlan.POST, await makeRequest("POST", "/x", { as, body: { planId: plan.id } }))).status).toBe(409);
    expect((await call(myPause.POST, await makeRequest("POST", "/x", { as, body: { from: iso(1), until: iso(15) } }))).status).toBe(409);
    expect((await call(myCancel.POST, await makeRequest("POST", "/x", { as, body: {} }))).status).toBe(409);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).planId).toBeNull();

    stripe = installFakeStripe();
    const res = await call(checkout.POST, await makeRequest("POST", "/x", { as, body: { planId: plan.id, acceptTerms: true } }));
    expect(res.status).toBe(200);
    expect(await prisma.legalAcceptance.count({ where: { memberId: m.id, context: "checkout" } })).toBe(2);
  });
});

describe("my account", () => {
  it("asks members added by staff to accept the terms once", async () => {
    const m = await createMember();
    const as = asMember(m);
    expect((await call(me.GET, await makeRequest("GET", "/x", { as }))).body.outstandingAcceptances).toEqual(["TERMS", "PRIVACY"]);
    await call(terms.POST, await makeRequest("POST", "/x", { as }));
    expect((await call(me.GET, await makeRequest("GET", "/x", { as }))).body.outstandingAcceptances).toEqual([]);
    expect(await prisma.legalAcceptance.count({ where: { memberId: m.id, context: "reaccept" } })).toBe(2);
  });

  it("changes name and email preferences, never the email address", async () => {
    const m = await createMember();
    const as = asMember(m);
    const res = await call(me.PATCH, await makeRequest("PATCH", "/x", { as, body: { name: "New Name", notifyAnnouncements: false, email: "evil@example.com" } }));
    expect(res.status).toBe(200);
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after).toMatchObject({ name: "New Name", notifyAnnouncements: false, email: m.email });
  });

  it("marks onboarding done", async () => {
    const m = await createMember();
    await prisma.member.update({ where: { id: m.id }, data: { onboardedAt: null } });
    await call(onboarding.POST, await makeRequest("POST", "/x", { as: asMember(m) }));
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).onboardedAt).not.toBeNull();
  });

  it("changing the password needs the current one and signs out other devices", async () => {
    const m = await createMember({ password: "old-password-123" });
    const as = asMember(m);
    expect((await call(password.POST, await makeRequest("POST", "/x", { as, body: { current: "wrong-password", next: "new-password-456" } }))).status).toBe(422);
    const ok = await call(password.POST, await makeRequest("POST", "/x", { as, body: { current: "old-password-123", next: "new-password-456" } }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toBeTruthy();
    // The old session (previous sessionVersion) no longer works.
    expect((await call(me.GET, await makeRequest("GET", "/x", { as }))).status).toBe(401);
  });

  it("staff sessions can't use member self-service routes", async () => {
    const staff = { staff: await createStaff("OWNER") };
    expect((await call(me.GET, await makeRequest("GET", "/x", { as: staff }))).status).toBe(401);
    expect((await call(exportData.GET, await makeRequest("GET", "/x", { as: staff }))).status).toBe(401);
    expect((await call(me.GET, await makeRequest("GET", "/x"))).status).toBe(401);
  });
});

describe("my membership", () => {
  it("shows plan change previews and cancellation dates under the owner's rules", async () => {
    const m = await oldMember({ planSlug: "standard", stripeSubscriptionId: "sub_opts" });
    const res = await call(membership.GET, await makeRequest("GET", "/x", { as: asMember(m) }));
    expect(res.status).toBe(200);
    const plans = res.body.plans as { slug: string; current: boolean; change: { upgrade: boolean; immediate: boolean } | null }[];
    expect(plans.find((p) => p.slug === "standard")).toMatchObject({ current: true, change: null });
    expect(plans.find((p) => p.slug === "unlimited")?.change).toMatchObject({ upgrade: true, immediate: true });
    expect(plans.find((p) => p.slug === "off-peak")?.change).toMatchObject({ upgrade: false, immediate: false });
    const cancellation = res.body.cancellation as { allowed: boolean; preview: { reason: string; effectiveAt: string } };
    expect(cancellation).toMatchObject({ allowed: true, preview: { reason: "notice" } });
    expect(Math.round((new Date(cancellation.preview.effectiveAt).getTime() - Date.now()) / DAY)).toBe(14);
    expect(res.body.selfServe).toBe(true);
  });

  it("upgrades through Stripe now and schedules a downgrade for the next billing date", async () => {
    stripe = installFakeStripe();
    const m = await oldMember({ planSlug: "standard", stripeSubscriptionId: "sub_up" });
    const as = asMember(m);
    const unlimited = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    const up = await call(myPlan.POST, await makeRequest("POST", "/x", { as, body: { planId: unlimited.id } }));
    expect(up.status).toBe(200);
    expect(up.body).toMatchObject({ immediate: true, upgrade: true });
    expect(stripe.calls.find((c) => c.method === "subscriptions.update")).toBeTruthy();
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).planId).toBe(unlimited.id);

    const offPeak = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "off-peak" } });
    const down = await call(myPlan.POST, await makeRequest("POST", "/x", { as, body: { planId: offPeak.id } }));
    expect(down.body).toMatchObject({ immediate: false, upgrade: false });
    expect(await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ planId: unlimited.id, pendingPlanId: offPeak.id });
    expect((await call(myPlan.POST, await makeRequest("POST", "/x", { as, body: { planId: offPeak.id } }))).status).toBe(409);
  });

  it("members who pay at the front desk change plans there", async () => {
    const m = await oldMember({ planSlug: "standard" });
    const unlimited = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    const res = await call(myPlan.POST, await makeRequest("POST", "/x", { as: asMember(m), body: { planId: unlimited.id } }));
    expect(res.status).toBe(409);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).planId).not.toBe(unlimited.id);
  });

  it("cancels with notice (no 'immediate' for members) and can withdraw", async () => {
    stripe = installFakeStripe();
    const m = await oldMember({ stripeSubscriptionId: "sub_cancel" });
    const as = asMember(m);
    const res = await call(myCancel.POST, await makeRequest("POST", "/x", { as, body: { reason: "Moving", immediate: true } }));
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("notice");
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.cancelAt).not.toBeNull();
    expect((await call(myCancel.DELETE, await makeRequest("DELETE", "/x", { as }))).status).toBe(200);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).cancelAt).toBeNull();
  });

  it("cancels straight away in the cooling-off period", async () => {
    stripe = installFakeStripe();
    const m = await createMember({ stripeSubscriptionId: "sub_cool" });
    const res = await call(myCancel.POST, await makeRequest("POST", "/x", { as: asMember(m), body: {} }));
    expect(res.body.reason).toBe("cooling_off");
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("CANCELED");
    expect(stripe.calls.some((c) => c.method === "subscriptions.cancel")).toBe(true);
  });

  it("pauses within the owner's limits and resumes", async () => {
    stripe = installFakeStripe();
    const m = await oldMember({ stripeSubscriptionId: "sub_pause" });
    const as = asMember(m);
    expect((await call(myPause.POST, await makeRequest("POST", "/x", { as, body: { from: iso(0), until: iso(200) } }))).status).toBe(422);
    expect((await call(myPause.POST, await makeRequest("POST", "/x", { as, body: { from: iso(0), until: iso(14) } }))).status).toBe(200);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("PAUSED");
    expect((await call(myPause.DELETE, await makeRequest("DELETE", "/x", { as }))).status).toBe(200);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("ACTIVE");
  });
});

describe("my classes", () => {
  it("lists classes with spots left but no other members' details", async () => {
    const cls = await classAt(24, 2);
    const other = await createMember({ name: "Someone Else" });
    await prisma.classBooking.create({ data: { classId: cls.id, memberId: other.id } });
    const m = await createMember();
    const res = await call(myClasses.GET, await makeRequest("GET", "/x", { as: asMember(m) }));
    expect(res.status).toBe(200);
    const listed = (res.body.classes as Record<string, unknown>[]).find((c) => c.id === cls.id)!;
    expect(listed).toMatchObject({ spotsLeft: 1, booked: false, waitlistPosition: null, bookingOpen: true });
    expect(JSON.stringify(res.body)).not.toContain("Someone Else");
    expect(JSON.stringify(res.body)).not.toContain(other.id);
  });

  it("books, cancels, and joins the waitlist when full", async () => {
    const cls = await classAt(24, 1);
    const a = await createMember();
    const b = await createMember();
    expect((await call(booking.POST, await makeRequest("POST", "/x", { as: asMember(a) }), { id: cls.id })).status).toBe(201);
    expect((await call(booking.POST, await makeRequest("POST", "/x", { as: asMember(b) }), { id: cls.id })).status).toBe(409);
    expect((await call(waitlist.POST, await makeRequest("POST", "/x", { as: asMember(b) }), { id: cls.id })).status).toBe(201);
    const listed = await call(myClasses.GET, await makeRequest("GET", "/x", { as: asMember(b) }));
    expect((listed.body.classes as Record<string, unknown>[])[0]).toMatchObject({ waitlistPosition: 1, spotsLeft: 0 });
    expect((await call(booking.DELETE, await makeRequest("DELETE", "/x", { as: asMember(a) }), { id: cls.id })).status).toBe(200);
    expect(await prisma.classBooking.findFirst({ where: { classId: cls.id, memberId: b.id } })).not.toBeNull();
  });

  it("won't book a class beyond the booking window", async () => {
    const cls = await classAt(24 * 10);
    const m = await createMember();
    const res = await call(booking.POST, await makeRequest("POST", "/x", { as: asMember(m) }), { id: cls.id });
    expect(res.status).toBe(409);
  });

  it("respects the waitlist email preference", async () => {
    captureEmailsForTests(true);
    const cls = await classAt(24, 1);
    const a = await createMember();
    const quiet = await createMember();
    await prisma.member.update({ where: { id: quiet.id }, data: { notifyWaitlist: false } });
    await prisma.classBooking.create({ data: { classId: cls.id, memberId: a.id } });
    await prisma.classWaitlist.create({ data: { classId: cls.id, memberId: quiet.id } });
    await cancelBooking(prisma, { kind: "member", id: a.id, name: a.name ?? "", email: a.email }, cls.id, a.id);
    expect(await prisma.classBooking.findFirst({ where: { classId: cls.id, memberId: quiet.id } })).not.toBeNull();
    expect(capturedEmails()).toHaveLength(0);
  });
});

describe("pass, invoices and data", () => {
  it("issues a QR pass for the signed-in member only", async () => {
    const m = await createMember();
    const res = await call(pass.GET, await makeRequest("GET", "/x", { as: asMember(m) }));
    expect(await readPassToken(res.body.token as string)).toMatchObject({ ok: true, memberId: m.id, version: 0 });
    // Short-lived, and the page is told when to fetch the next one (D-119).
    expect(new Date(res.body.expiresAt as string).getTime() - Date.now()).toBeLessThanOrEqual(90_000);
    expect(res.body.refreshSeconds).toBe(60);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("shows a member their own tax invoice and nobody else's", async () => {
    const m = await createMember();
    const other = await createMember();
    const mine = await prisma.payment.create({ data: { memberId: m.id, amount: 3995, gstCents: 363, status: "succeeded" } });
    const theirs = await prisma.payment.create({ data: { memberId: other.id, amount: 3995, gstCents: 363, status: "succeeded" } });
    const ok = await call(myInvoice.GET, await makeRequest("GET", "/x", { as: asMember(m) }), { id: mine.id });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ title: "Tax invoice", gstCents: 363 });
    expect((await call(myInvoice.GET, await makeRequest("GET", "/x", { as: asMember(m) }), { id: theirs.id })).status).toBe(404);
  });

  it("exports the member's own data, including staff notes, and nothing about others", async () => {
    const m = await createMember({ name: "Export Me" });
    const other = await createMember({ name: "Not Me" });
    await prisma.payment.create({ data: { memberId: m.id, amount: 2995, gstCents: 272, status: "succeeded", description: "Membership" } });
    await prisma.payment.create({ data: { memberId: other.id, amount: 9999, gstCents: 909, status: "succeeded" } });
    await prisma.memberNote.create({ data: { memberId: m.id, staffName: "Desk", body: "Prefers mornings" } });
    const res = await call(exportData.GET, await makeRequest("GET", "/x", { as: asMember(m) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = JSON.stringify(res.body);
    expect(res.body).toMatchObject({ name: "Export Me", email: m.email });
    expect(text).toContain("Prefers mornings");
    expect(text).not.toContain("Not Me");
    expect(text).not.toContain("9999");
    expect(text).not.toContain("passwordHash");
  });
});

describe("deleting an account", () => {
  it("is blocked while the membership is active", async () => {
    const m = await createMember({ password: "member-password" });
    const as = asMember(m);
    expect(((await call(account.GET, await makeRequest("GET", "/x", { as }))).body.blockers as unknown[]).length).toBe(1);
    const res = await call(account.DELETE, await makeRequest("DELETE", "/x", { as, body: { password: "member-password", confirm: "DELETE" } }));
    expect(res.status).toBe(409);
  });

  it("needs the password and the word DELETE", async () => {
    const m = await createMember({ password: "member-password", status: "CANCELED" });
    const as = asMember(m);
    expect((await call(account.DELETE, await makeRequest("DELETE", "/x", { as, body: { password: "wrong", confirm: "DELETE" } }))).status).toBe(422);
    expect((await call(account.DELETE, await makeRequest("DELETE", "/x", { as, body: { password: "member-password", confirm: "delete" } }))).status).toBe(422);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).anonymisedAt).toBeNull();
  });

  it("erases personal details, keeps financial records, and ends access", async () => {
    const staff = await createStaff("OWNER");
    const m = await createMember({ password: "member-password", status: "CANCELED", name: "Erase Me", email: "erase@example.com" });
    await prisma.auditLog.create({ data: { staffId: staff.id, staffName: staff.name, action: "member.created", targetType: "Member", targetId: m.id, details: { name: "Erase Me", email: "erase@example.com" } } });
    const payment = await prisma.payment.create({ data: { memberId: m.id, amount: 3995, gstCents: 363, status: "succeeded" } });
    const order = await prisma.order.create({
      data: { memberId: m.id, email: m.email, customerName: "Erase Me", status: "COMPLETED", subtotalCents: 3500, totalCents: 3500, gstCents: 318, fulfilment: "SHIPPING", shippingAddress: { line1: "1 Private St", suburb: "Newtown", state: "NSW", postcode: "2042" } },
    });
    await prisma.memberNote.create({ data: { memberId: m.id, staffName: "Desk", body: "Knee injury" } });
    const future = await classAt(48);
    await prisma.classBooking.create({ data: { classId: future.id, memberId: m.id } });

    const as = asMember(m);
    const res = await call(account.DELETE, await makeRequest("DELETE", "/x", { as, body: { password: "member-password", confirm: "DELETE" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");

    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after).toMatchObject({ name: "Deleted member", passwordHash: null, notes: null });
    expect(after.email).toBe(`deleted-${m.id}@deleted.invalid`);
    expect(after.anonymisedAt).not.toBeNull();
    expect(await prisma.payment.findUnique({ where: { id: payment.id } })).toMatchObject({ amount: 3995, gstCents: 363 });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o).toMatchObject({ customerName: "Deleted member", shippingAddress: null, totalCents: 3500 });
    expect(await prisma.memberNote.count({ where: { memberId: m.id } })).toBe(0);
    expect(await prisma.classBooking.count({ where: { memberId: m.id } })).toBe(0);
    const audit = JSON.stringify(await prisma.auditLog.findMany());
    expect(audit).not.toContain("Erase Me");
    expect(audit).not.toContain("erase@example.com");

    expect((await call(me.GET, await makeRequest("GET", "/x", { as }))).status).toBe(401);
    const login = await call(memberLogin.POST, await makeRequest("POST", "/x", { body: { email: "erase@example.com", password: "member-password" } }));
    expect(login.status).toBe(401);
    // The email is free for a fresh sign-up later.
    expect((await call(signup.POST, await makeRequest("POST", "/x", { body: { name: "Back Again", email: "erase@example.com", password: "a-long-password", acceptTerms: true } }))).status).toBe(201);
  });
});

describe("data retention (config: check-ins 24 months, archived members 24 months)", () => {
  it("deletes old check-ins and anonymises long-archived members, keeping payments", async () => {
    const { applyDataRetention } = await import("@/lib/jobs/daily");
    const recent = await createMember({ name: "Recent Leaver" });
    const old = await createMember({ name: "Long Gone", status: "CANCELED" });
    const longAgo = new Date(Date.now() - 800 * DAY);
    await prisma.member.update({ where: { id: old.id }, data: { archivedAt: longAgo } });
    await prisma.member.update({ where: { id: recent.id }, data: { archivedAt: new Date(Date.now() - 30 * DAY) } });
    await prisma.checkIn.createMany({ data: [{ memberId: recent.id, timestamp: longAgo }, { memberId: recent.id, timestamp: new Date() }] });
    await prisma.payment.create({ data: { memberId: old.id, amount: 2995, gstCents: 272, status: "succeeded" } });

    const result = await applyDataRetention(prisma);
    expect(result).toEqual({ checkInsDeleted: 1, membersAnonymised: 1 });
    expect(await prisma.checkIn.count()).toBe(1);
    expect(await prisma.member.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ name: "Deleted member" });
    expect(await prisma.member.findUniqueOrThrow({ where: { id: recent.id } })).toMatchObject({ name: "Recent Leaver", anonymisedAt: null });
    expect(await prisma.payment.count({ where: { memberId: old.id } })).toBe(1);
    expect(await applyDataRetention(prisma)).toEqual({ checkInsDeleted: 0, membersAnonymised: 0 });
  });
});
