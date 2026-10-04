import { beforeAll, describe, expect, it } from "vitest";
import type { StaffRole } from "@prisma/client";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { can, type Permission } from "@/lib/auth/permissions";

import * as agentActions from "@/app/api/agent-actions/route";
import * as auditLog from "@/app/api/audit-log/route";
import * as checkIn from "@/app/api/check-in/route";
import * as classes from "@/app/api/classes/route";
import * as classById from "@/app/api/classes/[id]/route";
import * as classBook from "@/app/api/classes/[id]/book/route";
import * as classWaitlist from "@/app/api/classes/[id]/waitlist/route";
import * as classPromote from "@/app/api/classes/[id]/waitlist/promote/route";
import * as dashboard from "@/app/api/dashboard/stats/route";
import * as equipment from "@/app/api/equipment/route";
import * as equipmentPo from "@/app/api/equipment/[id]/po/route";
import * as inventory from "@/app/api/inventory/route";
import * as inventoryById from "@/app/api/inventory/[id]/route";
import * as members from "@/app/api/members/route";
import * as memberById from "@/app/api/members/[id]/route";
import * as payments from "@/app/api/payments/route";
import * as planById from "@/app/api/plans/[id]/route";
import * as features from "@/app/api/settings/features/route";
import * as shifts from "@/app/api/shifts/route";
import * as shiftById from "@/app/api/shifts/[id]/route";
import * as staff from "@/app/api/staff/route";
import * as staffById from "@/app/api/staff/[id]/route";
import * as me from "@/app/api/me/route";
import * as myBookings from "@/app/api/me/bookings/route";
import * as myPayments from "@/app/api/me/payments/route";
import * as portal from "@/app/api/billing-portal/route";
import * as checkout from "@/app/api/checkout/route";

type Handler = Parameters<typeof call>[0];
interface Case {
  name: string;
  handler: Handler;
  method: string;
  path: string;
  permission: Permission;
  params?: Record<string, string>;
  body?: unknown;
}

// Every staff endpoint, the permission it needs, and a body that would pass
// validation, so a denied request is denied for authorisation alone.
const ID = "does-not-exist";
const STAFF_CASES: Case[] = [
  { name: "GET approvals", handler: agentActions.GET, method: "GET", path: "/api/agent-actions", permission: "equipment:read" },
  { name: "PATCH approval", handler: agentActions.PATCH, method: "PATCH", path: "/api/agent-actions", permission: "equipment:manage", body: { id: ID, status: "APPROVED" } },
  { name: "GET audit log", handler: auditLog.GET, method: "GET", path: "/api/audit-log", permission: "audit:read" },
  { name: "GET check-ins", handler: checkIn.GET, method: "GET", path: "/api/check-in", permission: "checkin:scan" },
  { name: "POST check-in", handler: checkIn.POST, method: "POST", path: "/api/check-in", permission: "checkin:scan", body: { query: "nobody@example.com" } },
  { name: "GET classes", handler: classes.GET, method: "GET", path: "/api/classes", permission: "classes:read" },
  { name: "POST class", handler: classes.POST, method: "POST", path: "/api/classes", permission: "classes:manage", body: { name: "Test", startTime: new Date(Date.now() + 86_400_000).toISOString() } },
  { name: "DELETE class", handler: classById.DELETE, method: "DELETE", path: `/api/classes/${ID}`, permission: "classes:manage", params: { id: ID } },
  { name: "POST booking", handler: classBook.POST, method: "POST", path: `/api/classes/${ID}/book`, permission: "classes:book", params: { id: ID }, body: { memberId: ID } },
  { name: "PATCH attendance", handler: classBook.PATCH, method: "PATCH", path: `/api/classes/${ID}/book`, permission: "classes:attendance", params: { id: ID }, body: { memberId: ID, status: "ATTENDED" } },
  { name: "DELETE booking", handler: classBook.DELETE, method: "DELETE", path: `/api/classes/${ID}/book?memberId=${ID}`, permission: "classes:book", params: { id: ID } },
  { name: "POST waitlist", handler: classWaitlist.POST, method: "POST", path: `/api/classes/${ID}/waitlist`, permission: "classes:book", params: { id: ID }, body: { memberId: ID } },
  { name: "POST promote", handler: classPromote.POST, method: "POST", path: `/api/classes/${ID}/waitlist/promote`, permission: "classes:book", params: { id: ID }, body: { memberId: ID } },
  { name: "GET dashboard", handler: dashboard.GET, method: "GET", path: "/api/dashboard/stats", permission: "dashboard:view" },
  { name: "GET equipment", handler: equipment.GET, method: "GET", path: "/api/equipment", permission: "equipment:read" },
  { name: "POST equipment", handler: equipment.POST, method: "POST", path: "/api/equipment", permission: "equipment:manage", body: { name: "Rower" } },
  { name: "POST purchase order", handler: equipmentPo.POST, method: "POST", path: `/api/equipment/${ID}/po`, permission: "equipment:manage", params: { id: ID } },
  { name: "GET stock", handler: inventory.GET, method: "GET", path: "/api/inventory", permission: "inventory:read" },
  { name: "POST stock item", handler: inventory.POST, method: "POST", path: "/api/inventory", permission: "inventory:manage", body: { name: "Chalk" } },
  { name: "PATCH stock level", handler: inventoryById.PATCH, method: "PATCH", path: `/api/inventory/${ID}`, permission: "inventory:adjust", params: { id: ID }, body: { delta: 1 } },
  { name: "PUT stock item", handler: inventoryById.PUT, method: "PUT", path: `/api/inventory/${ID}`, permission: "inventory:manage", params: { id: ID }, body: { name: "Chalk" } },
  { name: "DELETE stock item", handler: inventoryById.DELETE, method: "DELETE", path: `/api/inventory/${ID}`, permission: "inventory:manage", params: { id: ID } },
  { name: "GET members", handler: members.GET, method: "GET", path: "/api/members", permission: "members:read" },
  { name: "POST member", handler: members.POST, method: "POST", path: "/api/members", permission: "members:write", body: { name: "New Person", email: "new.person@example.com" } },
  { name: "GET member", handler: memberById.GET, method: "GET", path: `/api/members/${ID}`, permission: "members:read", params: { id: ID } },
  { name: "PUT member", handler: memberById.PUT, method: "PUT", path: `/api/members/${ID}`, permission: "members:write", params: { id: ID }, body: { name: "Renamed" } },
  { name: "DELETE member", handler: memberById.DELETE, method: "DELETE", path: `/api/members/${ID}`, permission: "members:archive", params: { id: ID } },
  { name: "GET payments", handler: payments.GET, method: "GET", path: "/api/payments", permission: "revenue:view" },
  { name: "PUT plan", handler: planById.PUT, method: "PUT", path: `/api/plans/${ID}`, permission: "plans:manage", params: { id: ID }, body: { priceCents: 100 } },
  { name: "GET features", handler: features.GET, method: "GET", path: "/api/settings/features", permission: "dashboard:view" },
  { name: "PUT features", handler: features.PUT, method: "PUT", path: "/api/settings/features", permission: "settings:manage", body: { requireKeycardForEntry: false, hideRevenueFromFrontDesk: false } },
  { name: "GET shifts", handler: shifts.GET, method: "GET", path: "/api/shifts", permission: "shifts:read" },
  { name: "POST shift", handler: shifts.POST, method: "POST", path: "/api/shifts", permission: "shifts:manage", body: { staffId: ID, startTime: "2030-01-01T00:00:00Z", endTime: "2030-01-01T04:00:00Z" } },
  { name: "DELETE shift", handler: shiftById.DELETE, method: "DELETE", path: `/api/shifts/${ID}`, permission: "shifts:manage", params: { id: ID } },
  { name: "GET staff", handler: staff.GET, method: "GET", path: "/api/staff", permission: "staff:read" },
  { name: "POST staff", handler: staff.POST, method: "POST", path: "/api/staff", permission: "staff:manage", body: { name: "New", email: "new.staff@example.com", password: "long-enough-password", role: "OWNER" } },
  { name: "PUT staff", handler: staffById.PUT, method: "PUT", path: `/api/staff/${ID}`, permission: "staff:manage", params: { id: ID }, body: { role: "OWNER" } },
  { name: "DELETE staff", handler: staffById.DELETE, method: "DELETE", path: `/api/staff/${ID}`, permission: "staff:manage", params: { id: ID } },
];

const ROLES: StaffRole[] = ["OWNER", "MANAGER", "FRONT_DESK", "TRAINER"];
const actors: Partial<Record<StaffRole, As>> = {};
let memberA: Awaited<ReturnType<typeof createMember>>;
let memberB: Awaited<ReturnType<typeof createMember>>;

beforeAll(async () => {
  await resetDb();
  for (const role of ROLES) actors[role] = { staff: await createStaff(role) };
  memberA = await createMember({ email: "member.a@example.com", password: "member-a-password" });
  memberB = await createMember({ email: "member.b@example.com", password: "member-b-password" });
  await prisma.payment.create({ data: { memberId: memberB.id, amount: 3995, gstCents: 363, status: "succeeded" } });
  await prisma.member.update({ where: { id: memberB.id }, data: { notes: "Private note about member B" } });
});

describe("every staff endpoint refuses callers who aren't signed in as staff", () => {
  it.each(STAFF_CASES)("$name: signed out -> 401", async (c) => {
    const res = await call(c.handler, await makeRequest(c.method, c.path, { body: c.body }), c.params);
    expect(res.status).toBe(401);
  });

  it.each(STAFF_CASES)("$name: signed in as a member -> 401, never any data", async (c) => {
    const res = await call(c.handler, await makeRequest(c.method, c.path, { as: { member: memberA }, body: c.body }), c.params);
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(memberB.email);
  });
});

describe("each staff role gets exactly its permissions", () => {
  const matrix = STAFF_CASES.flatMap((c) => ROLES.map((role) => ({ ...c, role, allowed: can(role, c.permission) })));
  it.each(matrix)("$role $name -> allowed: $allowed", async (c) => {
    const res = await call(c.handler, await makeRequest(c.method, c.path, { as: actors[c.role]!, body: c.body }), c.params);
    if (c.allowed) {
      expect([401, 403]).not.toContain(res.status);
    } else {
      expect(res.status).toBe(403);
    }
  });
});

describe("member data isolation", () => {
  it("/api/me returns only the signed-in member, whatever is in the URL", async () => {
    const res = await call(me.GET, await makeRequest("GET", `/api/me?id=${memberB.id}&memberId=${memberB.id}`, { as: { member: memberA } }));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(memberA.id);
    expect(JSON.stringify(res.body)).not.toContain(memberB.email);
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("stripeCustomerId");
  });

  it("member A can't see member B's payments or bookings", async () => {
    const pay = await call(myPayments.GET, await makeRequest("GET", `/api/me/payments?memberId=${memberB.id}`, { as: { member: memberA } }));
    expect(pay.status).toBe(200);
    expect(pay.body).toEqual([]);
    const bookings = await call(myBookings.GET, await makeRequest("GET", "/api/me/bookings", { as: { member: memberA } }));
    expect(bookings.status).toBe(200);
  });

  it("member A can't read member B through the staff member endpoint", async () => {
    const res = await call(memberById.GET, await makeRequest("GET", `/api/members/${memberB.id}`, { as: { member: memberA } }), { id: memberB.id });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain("Private note");
  });

  it("member A can't open a billing portal for anyone else (body is ignored)", async () => {
    await prisma.member.update({ where: { id: memberB.id }, data: { stripeCustomerId: "cus_member_b" } });
    const res = await call(portal.POST, await makeRequest("POST", "/api/billing-portal", { as: { member: memberA }, body: { memberId: memberB.id } }));
    // Member A has no card on file; B's customer is never used.
    expect(res.status).toBe(409);
  });

  it("staff can't use member-only endpoints", async () => {
    for (const handler of [me.GET, myPayments.GET, myBookings.GET]) {
      const res = await call(handler, await makeRequest("GET", "/api/me", { as: actors.OWNER! }));
      expect(res.status).toBe(401);
    }
    const res = await call(checkout.POST, await makeRequest("POST", "/api/checkout", { as: actors.OWNER!, body: { planId: "x", acceptTerms: true } }));
    expect(res.status).toBe(401);
  });

  it("a forged member token pointing at another member's id is refused (version mismatch)", async () => {
    const res = await call(me.GET, await makeRequest("GET", "/api/me", { as: { member: { ...memberB, sessionVersion: memberB.sessionVersion + 7 } } }));
    expect(res.status).toBe(401);
  });
});

describe("session revocation", () => {
  it("a role change or sign-out takes effect on the next request", async () => {
    const person = await createStaff("MANAGER");
    const asBefore: As = { staff: person };
    expect((await call(payments.GET, await makeRequest("GET", "/api/payments", { as: asBefore }))).status).toBe(200);
    await prisma.staff.update({ where: { id: person.id }, data: { sessionVersion: { increment: 1 } } });
    expect((await call(payments.GET, await makeRequest("GET", "/api/payments", { as: asBefore }))).status).toBe(401);
  });

  it("an archived member's session stops working", async () => {
    const m = await createMember();
    const as: As = { member: m };
    expect((await call(me.GET, await makeRequest("GET", "/api/me", { as }))).status).toBe(200);
    await prisma.member.update({ where: { id: m.id }, data: { archivedAt: new Date() } });
    expect((await call(me.GET, await makeRequest("GET", "/api/me", { as }))).status).toBe(401);
  });

  it("a deleted staff account's session stops working", async () => {
    const person = await createStaff("OWNER");
    const as: As = { staff: person };
    await prisma.staff.delete({ where: { id: person.id } });
    expect((await call(staff.GET, await makeRequest("GET", "/api/staff", { as }))).status).toBe(401);
  });
});

describe("revenue hiding is enforced on the server", () => {
  it("front desk gets no revenue figure or payments when the owner hides revenue", async () => {
    await prisma.gymSettings.upsert({ where: { id: "singleton" }, update: { hideRevenueFromFrontDesk: true }, create: { id: "singleton", hideRevenueFromFrontDesk: true } });
    try {
      const stats = await call(dashboard.GET, await makeRequest("GET", "/api/dashboard/stats", { as: actors.FRONT_DESK! }));
      expect(stats.status).toBe(200);
      expect(stats.body.mrrCents).toBeNull();
      expect((await call(payments.GET, await makeRequest("GET", "/api/payments", { as: actors.FRONT_DESK! }))).status).toBe(403);
      const detail = await call(memberById.GET, await makeRequest("GET", `/api/members/${memberB.id}`, { as: actors.FRONT_DESK! }), { id: memberB.id });
      expect(detail.body.payments).toBeNull();
      const managerStats = await call(dashboard.GET, await makeRequest("GET", "/api/dashboard/stats", { as: actors.MANAGER! }));
      expect(typeof managerStats.body.mrrCents).toBe("number");
    } finally {
      await prisma.gymSettings.update({ where: { id: "singleton" }, data: { hideRevenueFromFrontDesk: false } });
    }
  });
});

describe("cross-site requests", () => {
  it("a mutation from another origin is refused even with a valid session", async () => {
    const req = await makeRequest("POST", "/api/members", { as: actors.OWNER!, body: { name: "X", email: "x@example.com" }, headers: { origin: "https://evil.example" } });
    expect((await call(members.POST, req)).status).toBe(403);
  });

  it("a form-encoded body is refused", async () => {
    const req = await makeRequest("POST", "/api/members", { as: actors.OWNER!, headers: { "content-type": "text/plain" } });
    const res = await call(members.POST, new Request(req, { body: '{"name":"X","email":"x@example.com"}' }));
    expect(res.status).toBe(400);
  });
});
