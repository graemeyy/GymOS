import { beforeEach, describe, expect, it } from "vitest";
import * as memberById from "@/app/api/members/[id]/route";
import * as members from "@/app/api/members/route";
import * as login from "@/app/api/auth/login/route";
import * as memberLogin from "@/app/api/auth/member-login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as bootstrap from "@/app/api/auth/bootstrap/route";
import * as staffById from "@/app/api/staff/[id]/route";
import * as checkout from "@/app/api/checkout/route";
import { setStripeForTests, type StripeClient } from "@/lib/billing/stripe";
import { call, createMember, createStaff, createStaffWith, makeRequest, prisma, resetDb } from "../helpers";

beforeEach(resetDb);

describe("members", () => {
  // R-94: lists are sorted in the database, so a capped list keeps the right
  // members, and paging through a sorted list misses nobody.
  it("sorts the list by retention score or name before capping it", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const people = [
      { name: "Cara", score: 55 },
      { name: "Abe", score: 90 },
      { name: "Bea", score: 12 },
    ];
    for (const p of people) {
      const m = await createMember({ name: p.name });
      await prisma.member.update({ where: { id: m.id }, data: { retentionScore: p.score } });
    }
    const list = async (q: string) => (await call(members.GET, await makeRequest("GET", `/api/members?${q}`, { as: owner }))).body as unknown as { items: { name: string }[]; nextCursor: string | null };
    expect((await list("sort=retention&take=2")).items.map((m) => m.name)).toEqual(["Bea", "Cara"]);
    const first = await list("sort=name&take=2");
    expect(first.items.map((m) => m.name)).toEqual(["Abe", "Bea"]);
    expect((await list(`sort=name&take=2&cursor=${first.nextCursor}`)).items.map((m) => m.name)).toEqual(["Cara"]);
  });

  // D-100: the Front desk preset no longer edits members; a role with
  // members.edit does, and status still only changes through the membership
  // actions.
  it("front desk can't edit members by default; members.edit can, but not status directly", async () => {
    const desk = { staff: await createStaff("STAFF") };
    const editor = { staff: await createStaffWith(["members.view", "members.edit"]) };
    const m = await createMember();
    expect((await call(memberById.PUT, await makeRequest("PUT", "/x", { as: desk, body: { name: "New Name" } }), { id: m.id })).status).toBe(403);
    expect((await call(memberById.PUT, await makeRequest("PUT", "/x", { as: editor, body: { name: "New Name" } }), { id: m.id })).status).toBe(200);
    const res = await call(memberById.PUT, await makeRequest("PUT", "/x", { as: editor, body: { status: "CANCELED" } }), { id: m.id });
    expect(res.status).toBe(422);
    expect(await prisma.member.findUniqueOrThrow({ where: { id: m.id }, select: { name: true, status: true } })).toEqual({ name: "New Name", status: "ACTIVE" });
  });

  it("archiving keeps payments and visits, releases future bookings, and blocks sign-in", async () => {
    const manager = { staff: await createStaff("MANAGER") };
    const m = await createMember({ password: "member-password-1" });
    await prisma.payment.create({ data: { memberId: m.id, amount: 2995, gstCents: 272, status: "succeeded" } });
    await prisma.checkIn.create({ data: { memberId: m.id } });
    const cls = await prisma.class.create({ data: { name: "Mobility", startTime: new Date(Date.now() + 86_400_000) } });
    await prisma.classBooking.create({ data: { classId: cls.id, memberId: m.id } });

    expect((await call(memberById.DELETE, await makeRequest("DELETE", "/x", { as: manager }), { id: m.id })).status).toBe(200);

    expect(await prisma.payment.count({ where: { memberId: m.id } })).toBe(1);
    expect(await prisma.checkIn.count({ where: { memberId: m.id } })).toBe(1);
    expect(await prisma.classBooking.count({ where: { memberId: m.id } })).toBe(0);
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.archivedAt).not.toBeNull();
    expect(after.status).toBe("CANCELED");
    const signIn = await call(memberLogin.POST, await makeRequest("POST", "/api/auth/member-login", { body: { email: m.email, password: "member-password-1" } }));
    expect(signIn.status).toBe(401);
    const list = await call(members.GET, await makeRequest("GET", "/api/members", { as: manager }));
    expect((list.body.items as { id: string }[]).some((x) => x.id === m.id)).toBe(false);
  });

  it("archiving a subscribed member cancels the Stripe subscription first, and stops if Stripe fails", async () => {
    const manager = { staff: await createStaff("MANAGER") };
    const m = await createMember({ stripeSubscriptionId: "sub_archive" });
    const cancelled: string[] = [];
    let fail = true;
    setStripeForTests({ subscriptions: { cancel: async (id: string) => { if (fail) throw new Error("Stripe down"); cancelled.push(id); return {}; } } } as unknown as StripeClient);
    try {
      const failed = await call(memberById.DELETE, await makeRequest("DELETE", "/x", { as: manager }), { id: m.id });
      expect(failed.status).toBe(502);
      expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).archivedAt).toBeNull();
      fail = false;
      expect((await call(memberById.DELETE, await makeRequest("DELETE", "/x", { as: manager }), { id: m.id })).status).toBe(200);
      expect(cancelled).toEqual(["sub_archive"]);
    } finally {
      setStripeForTests(null);
    }
  });

  it("rejects a duplicate email and invalid input with field errors", async () => {
    const desk = { staff: await createStaff("MANAGER") };
    await createMember({ email: "taken@example.com" });
    const dup = await call(members.POST, await makeRequest("POST", "/api/members", { as: desk, body: { name: "Someone", email: "Taken@Example.com" } }));
    expect(dup.status).toBe(409);
    const bad = await call(members.POST, await makeRequest("POST", "/api/members", { as: desk, body: { name: "", email: "not-an-email" } }));
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error?.fields ?? {})).toEqual(expect.arrayContaining(["name", "email"]));
  });
});

describe("sign-in", () => {
  it("staff sign-in sets an httpOnly cookie and a generic error for bad credentials", async () => {
    await createStaff("OWNER", { email: "boss@example.com", password: "right-password-123" });
    const bad = await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "boss@example.com", password: "wrong" } }));
    const unknown = await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "nobody@example.com", password: "wrong" } }));
    expect(bad.status).toBe(401);
    expect(unknown.body.error?.message).toBe(bad.body.error?.message);
    const ok = await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "BOSS@example.com", password: "right-password-123" } }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/gymos_session=.+HttpOnly/i);
  });

  // Changed by review R-40: five failures used to lock the account for
  // everyone, which let anyone lock the owner out. Now five failures lock
  // that address out of the account, and a higher cap (50) applies across
  // all addresses.
  it("locks an address out of an account after repeated wrong passwords", async () => {
    await createStaff("OWNER", { email: "target@example.com", password: "right-password-123" });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "target@example.com", password: `guess-${i}` }, headers: { "x-forwarded-for": "10.0.0.1" } }));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });

  it("caps wrong passwords for one account across many addresses", async () => {
    await createStaff("OWNER", { email: "spread@example.com", password: "right-password-123" });
    const statuses: number[] = [];
    for (let i = 0; i < 52; i++) {
      const res = await call(login.POST, await makeRequest("POST", "/api/auth/login", { body: { email: "spread@example.com", password: `guess-${i}` }, headers: { "x-forwarded-for": `10.1.${Math.floor(i / 200)}.${i % 200}` } }));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 50).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(50)).toEqual([429, 429]);
  });

  it("signing out revokes the session everywhere", async () => {
    const person = await createStaff("MANAGER");
    const as = { staff: person };
    await call(logout.POST, await makeRequest("POST", "/api/auth/logout", { as }));
    expect((await prisma.staff.findUniqueOrThrow({ where: { id: person.id } })).sessionVersion).toBe(person.sessionVersion + 1);
  });

  it("owner bootstrap works once and only once", async () => {
    const body = { name: "First Owner", email: "first@example.com", password: "a-long-password" };
    const [a, b] = await Promise.all([
      call(bootstrap.POST, await makeRequest("POST", "/api/auth/bootstrap", { body })),
      call(bootstrap.POST, await makeRequest("POST", "/api/auth/bootstrap", { body: { ...body, email: "second@example.com" } })),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.staff.count()).toBe(1);
  });

  it("the last owner can't be demoted", async () => {
    const owner = await createStaff("OWNER");
    const res = await call(staffById.PUT, await makeRequest("PUT", "/x", { as: { staff: owner }, body: { roleId: "role_manager" } }), { id: owner.id });
    expect(res.status).toBe(409);
    expect((await prisma.staff.findUniqueOrThrow({ where: { id: owner.id } })).roleId).toBe("role_owner");
  });
});

describe("member checkout", () => {
  it("answers 503 (not a crash) when Stripe isn't configured", async () => {
    const m = await createMember();
    const plan = await prisma.membershipPlan.findFirstOrThrow();
    const res = await call(checkout.POST, await makeRequest("POST", "/api/checkout", { as: { member: m }, body: { planId: plan.id, acceptTerms: true } }));
    expect(res.status).toBe(503);
  });

  it("requires accepting the terms", async () => {
    const m = await createMember();
    const plan = await prisma.membershipPlan.findFirstOrThrow();
    const res = await call(checkout.POST, await makeRequest("POST", "/api/checkout", { as: { member: m }, body: { planId: plan.id, acceptTerms: false } }));
    expect(res.status).toBe(422);
  });

  it("creates an AUD, GST-inclusive subscription for the signed-in member only", async () => {
    const m = await createMember();
    const plan = await prisma.membershipPlan.findFirstOrThrow({ where: { slug: "standard" } });
    let captured: Record<string, unknown> | null = null;
    setStripeForTests({ checkout: { sessions: { create: async (args: Record<string, unknown>) => { captured = args; return { url: "https://checkout.stripe.com/test" }; } } } } as unknown as StripeClient);
    try {
      const res = await call(checkout.POST, await makeRequest("POST", "/api/checkout", { as: { member: m }, body: { planId: plan.id, acceptTerms: true, memberId: "someone-else" } }));
      expect(res.status).toBe(200);
      expect(captured).toMatchObject({
        mode: "subscription",
        client_reference_id: m.id,
        metadata: { memberId: m.id, planId: plan.id },
        line_items: [{ price_data: { currency: "aud", unit_amount: plan.priceCents, recurring: { interval: "week", interval_count: 1 } } }],
      });
    } finally {
      setStripeForTests(null);
    }
  });
});
