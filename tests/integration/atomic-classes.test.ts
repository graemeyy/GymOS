// R-98: a change and its audit entry are written together or not at all.
// The audit write is made to fail; the change must not be left behind.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { As } from "../helpers";

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

const classes = await import("@/app/api/classes/route");
const classById = await import("@/app/api/classes/[id]/route");
const book = await import("@/app/api/classes/[id]/book/route");
const waitlist = await import("@/app/api/classes/[id]/waitlist/route");
const promote = await import("@/app/api/classes/[id]/waitlist/promote/route");
const meBooking = await import("@/app/api/me/classes/[id]/booking/route");
const meWaitlist = await import("@/app/api/me/classes/[id]/waitlist/route");
const templates = await import("@/app/api/class-templates/route");
const templateById = await import("@/app/api/class-templates/[id]/route");
const generate = await import("@/app/api/class-templates/generate/route");
const shifts = await import("@/app/api/shifts/route");
const shiftById = await import("@/app/api/shifts/[id]/route");
const equipment = await import("@/app/api/equipment/route");
const purchaseOrder = await import("@/app/api/equipment/[id]/po/route");
const agentActions = await import("@/app/api/agent-actions/route");
const { call, createMember, createStaff, makeRequest, prisma, resetDb } = await import("../helpers");

const HOUR = 3_600_000;
let owner: As;

beforeEach(async () => {
  await resetDb();
  owner = { staff: await createStaff("OWNER") };
});
afterEach(() => {
  failAudit.on = false;
});

const tomorrowClass = (capacity = 10) => prisma.class.create({ data: { name: "Conditioning", startTime: new Date(Date.now() + 24 * HOUR), capacity } });

async function expectFailure(send: () => Promise<{ status: number }>) {
  failAudit.on = true;
  expect((await send()).status).toBe(500);
  failAudit.on = false;
}

describe("R-98 classes", () => {
  it("creating a class rolls back", async () => {
    await expectFailure(async () => call(classes.POST, await makeRequest("POST", "/x", { as: owner, body: { name: "Yoga", startTime: new Date(Date.now() + 24 * HOUR).toISOString() } })));
    expect(await prisma.class.count()).toBe(0);
  });

  it("cancelling a class rolls back", async () => {
    const cls = await tomorrowClass();
    const member = await createMember();
    await prisma.classBooking.create({ data: { classId: cls.id, memberId: member.id } });
    await expectFailure(async () => call(classById.DELETE, await makeRequest("DELETE", "/x", { as: owner }), { id: cls.id }));
    expect(await prisma.class.findUniqueOrThrow({ where: { id: cls.id } })).toMatchObject({ cancelledAt: null });
    expect(await prisma.classBooking.count({ where: { classId: cls.id } })).toBe(1);
  });

  it("booking, marking attendance and cancelling a booking roll back", async () => {
    const cls = await tomorrowClass();
    const [booked, other] = [await createMember(), await createMember()];
    await prisma.classBooking.create({ data: { classId: cls.id, memberId: booked.id } });

    await expectFailure(async () => call(book.POST, await makeRequest("POST", "/x", { as: owner, body: { memberId: other.id } }), { id: cls.id }));
    await expectFailure(async () => call(book.PATCH, await makeRequest("PATCH", "/x", { as: owner, body: { memberId: booked.id, status: "ATTENDED" } }), { id: cls.id }));
    await expectFailure(async () => call(book.DELETE, await makeRequest("DELETE", `/x?memberId=${booked.id}`, { as: owner }), { id: cls.id }));

    expect(await prisma.classBooking.findMany({ where: { classId: cls.id }, select: { memberId: true, status: true } })).toEqual([{ memberId: booked.id, status: "BOOKED" }]);
  });

  it("members booking and cancelling their own place roll back", async () => {
    const cls = await tomorrowClass();
    const [booked, other] = [await createMember(), await createMember()];
    await prisma.classBooking.create({ data: { classId: cls.id, memberId: booked.id } });

    await expectFailure(async () => call(meBooking.POST, await makeRequest("POST", "/x", { as: { member: other } }), { id: cls.id }));
    await expectFailure(async () => call(meBooking.DELETE, await makeRequest("DELETE", "/x", { as: { member: booked } }), { id: cls.id }));

    expect(await prisma.classBooking.findMany({ where: { classId: cls.id }, select: { memberId: true } })).toEqual([{ memberId: booked.id }]);
  });

  it("joining a waitlist rolls back, for staff and members", async () => {
    const cls = await tomorrowClass(1);
    const [booked, waiting] = [await createMember(), await createMember()];
    await prisma.classBooking.create({ data: { classId: cls.id, memberId: booked.id } });

    await expectFailure(async () => call(waitlist.POST, await makeRequest("POST", "/x", { as: owner, body: { memberId: waiting.id } }), { id: cls.id }));
    await expectFailure(async () => call(meWaitlist.POST, await makeRequest("POST", "/x", { as: { member: waiting } }), { id: cls.id }));

    expect(await prisma.classWaitlist.count()).toBe(0);
  });

  it("staff removing someone from a waitlist rolls back", async () => {
    const cls = await tomorrowClass(1);
    const waiting = await createMember();
    await prisma.classWaitlist.create({ data: { classId: cls.id, memberId: waiting.id } });
    await expectFailure(async () => call(waitlist.DELETE, await makeRequest("DELETE", `/x?memberId=${waiting.id}`, { as: owner }), { id: cls.id }));
    expect(await prisma.classWaitlist.count({ where: { classId: cls.id } })).toBe(1);
  });

  it("a member leaving a waitlist rolls back", async () => {
    const cls = await tomorrowClass(1);
    const waiting = await createMember();
    await prisma.classWaitlist.create({ data: { classId: cls.id, memberId: waiting.id } });
    await expectFailure(async () => call(meWaitlist.DELETE, await makeRequest("DELETE", "/x", { as: { member: waiting } }), { id: cls.id }));
    expect(await prisma.classWaitlist.count({ where: { classId: cls.id } })).toBe(1);
  });

  it("promoting from the waitlist rolls back", async () => {
    const cls = await tomorrowClass(2);
    const waiting = await createMember();
    await prisma.classWaitlist.create({ data: { classId: cls.id, memberId: waiting.id } });
    await expectFailure(async () => call(promote.POST, await makeRequest("POST", "/x", { as: owner, body: { memberId: waiting.id } }), { id: cls.id }));
    expect(await prisma.classWaitlist.count({ where: { classId: cls.id } })).toBe(1);
    expect(await prisma.classBooking.count({ where: { classId: cls.id } })).toBe(0);
  });
});

describe("R-98 timetable", () => {
  const slot = { name: "HIIT", weekday: 2, startTime: "06:00", durationMinutes: 45, capacity: 10 };

  it("adding a slot rolls back", async () => {
    await expectFailure(async () => call(templates.POST, await makeRequest("POST", "/x", { as: owner, body: slot })));
    expect(await prisma.classTemplate.count()).toBe(0);
  });

  it("editing a slot rolls back", async () => {
    const t = await prisma.classTemplate.create({ data: slot });
    await expectFailure(async () => call(templateById.PUT, await makeRequest("PUT", "/x", { as: owner, body: { ...slot, name: "Renamed" } }), { id: t.id }));
    expect(await prisma.classTemplate.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ name: "HIIT" });
  });

  it("deleting a slot rolls back", async () => {
    const t = await prisma.classTemplate.create({ data: slot });
    await expectFailure(async () => call(templateById.DELETE, await makeRequest("DELETE", "/x", { as: owner }), { id: t.id }));
    expect(await prisma.classTemplate.count()).toBe(1);
  });

  it("generating classes rolls back", async () => {
    await prisma.classTemplate.create({ data: slot });
    await expectFailure(async () => call(generate.POST, await makeRequest("POST", "/x", { as: owner, body: { weeks: 2 } })));
    expect(await prisma.class.count()).toBe(0);
  });
});

describe("R-98 shifts", () => {
  it("adding a shift rolls back", async () => {
    const trainer = await createStaff("TRAINER");
    const startTime = new Date(Date.now() + 24 * HOUR);
    const body = { staffId: trainer.id, startTime: startTime.toISOString(), endTime: new Date(startTime.getTime() + 4 * HOUR).toISOString() };
    await expectFailure(async () => call(shifts.POST, await makeRequest("POST", "/x", { as: owner, body })));
    expect(await prisma.shift.count()).toBe(0);
  });

  it("deleting a shift rolls back", async () => {
    const trainer = await createStaff("TRAINER");
    const startTime = new Date(Date.now() + 24 * HOUR);
    const shift = await prisma.shift.create({ data: { staffId: trainer.id, startTime, endTime: new Date(startTime.getTime() + 4 * HOUR) } });
    await expectFailure(async () => call(shiftById.DELETE, await makeRequest("DELETE", "/x", { as: owner }), { id: shift.id }));
    expect(await prisma.shift.count()).toBe(1);
  });
});

describe("R-98 equipment and approvals", () => {
  it("adding equipment rolls back", async () => {
    await expectFailure(async () => call(equipment.POST, await makeRequest("POST", "/x", { as: owner, body: { name: "Rower" } })));
    expect(await prisma.equipment.count()).toBe(0);
  });

  it("drafting a purchase order rolls back", async () => {
    const rower = await prisma.equipment.create({ data: { name: "Rower", status: "OFFLINE", estimatedCost: 12_000 } });
    await expectFailure(async () => call(purchaseOrder.POST, await makeRequest("POST", "/x", { as: owner }), { id: rower.id }));
    expect(await prisma.agentAction.count()).toBe(0);
  });

  it("deciding an approval rolls back", async () => {
    const action = await prisma.agentAction.create({ data: { title: "Purchase order: Rower", description: "Part", category: "MAINTENANCE" } });
    await expectFailure(async () => call(agentActions.PATCH, await makeRequest("PATCH", "/x", { as: owner, body: { id: action.id, status: "APPROVED" } })));
    expect(await prisma.agentAction.findUniqueOrThrow({ where: { id: action.id } })).toMatchObject({ status: "PENDING" });
  });
});
