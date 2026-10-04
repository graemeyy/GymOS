import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as book from "@/app/api/classes/[id]/book/route";
import * as waitlist from "@/app/api/classes/[id]/waitlist/route";
import * as generate from "@/app/api/class-templates/generate/route";
import { getBenefitUsage } from "@/lib/membership/benefits";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";

const HOUR = 3_600_000;
let desk: As;

beforeEach(async () => {
  await resetDb();
  desk = { staff: await createStaff("FRONT_DESK") };
  captureEmailsForTests(true);
});
afterEach(() => captureEmailsForTests(false));

async function memberOnPlan(slug: string) {
  const m = await createMember();
  const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug } });
  return prisma.member.update({ where: { id: m.id }, data: { planId: plan.id } });
}
const newClass = (hoursAhead: number, capacity = 10) => prisma.class.create({ data: { name: "Conditioning", startTime: new Date(Date.now() + hoursAhead * HOUR), capacity } });
const bookReq = async (classId: string, memberId: string, casual = false) => call(book.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId, casual } }), { id: classId });

describe("class credits (Standard plan: 2 per week)", () => {
  it("uses a credit per booking and refuses when none are left, unless casual", async () => {
    const m = await memberOnPlan("standard");
    const [a, b, c] = [await newClass(24), await newClass(48), await newClass(72)];
    expect((await bookReq(a.id, m.id)).status).toBe(201);
    expect((await bookReq(b.id, m.id)).status).toBe(201);
    expect((await getBenefitUsage(prisma, m.id)).classCredits.remaining).toBe(0);
    const third = await bookReq(c.id, m.id);
    expect(third.status).toBe(409);
    expect(third.body.error?.message).toMatch(/No class credits left/);
    expect((await bookReq(c.id, m.id, true)).status).toBe(201);
    expect(await prisma.classBooking.count({ where: { memberId: m.id, usedCredit: false } })).toBe(1);
  });

  it("unlimited plans never run out", async () => {
    const m = await memberOnPlan("unlimited");
    for (let i = 1; i <= 4; i++) expect((await bookReq((await newClass(24 * i)).id, m.id)).status).toBe(201);
    expect((await getBenefitUsage(prisma, m.id)).classCredits.remaining).toBeNull();
  });

  it("returns the credit for a timely cancellation", async () => {
    const m = await memberOnPlan("standard");
    const cls = await newClass(24);
    await bookReq(cls.id, m.id);
    const res = await call(book.DELETE, await makeRequest("DELETE", `/x?memberId=${m.id}`, { as: desk }), { id: cls.id });
    expect(res.body.creditReturned).toBe(true);
    expect((await getBenefitUsage(prisma, m.id)).classCredits.remaining).toBe(2);
  });
});

describe("waitlist", () => {
  it("moves the first eligible person in when a spot opens, and emails them", async () => {
    const cls = await newClass(24, 1);
    const [a, b, c] = [await memberOnPlan("unlimited"), await memberOnPlan("standard"), await memberOnPlan("unlimited")];
    await bookReq(cls.id, a.id);
    // b has used both credits, so can't be promoted; c is next.
    await prisma.benefitLedger.createMany({ data: [0, 1].map(() => ({ memberId: b.id, kind: "CLASS_CREDIT" as const, delta: -1, reason: "Class booking", refType: "booking" })) });
    for (const m of [b, c]) await call(waitlist.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: m.id } }), { id: cls.id });

    const res = await call(book.DELETE, await makeRequest("DELETE", `/x?memberId=${a.id}`, { as: desk }), { id: cls.id });
    expect(res.body.promotedMemberId).toBe(c.id);
    expect(await prisma.classBooking.findMany({ where: { classId: cls.id }, select: { memberId: true } })).toEqual([{ memberId: c.id }]);
    expect(await prisma.classWaitlist.count({ where: { classId: cls.id, memberId: b.id } })).toBe(1);
    expect(capturedEmails()).toHaveLength(1);
    expect(capturedEmails()[0]).toMatchObject({ to: c.email, subject: "You're in: Conditioning" });
  });
});

describe("trainers", () => {
  it("can only mark attendance for their own classes", async () => {
    const trainer = await createStaff("TRAINER");
    const other = await createStaff("TRAINER");
    const m = await memberOnPlan("unlimited");
    const mine = await prisma.class.create({ data: { name: "Mine", startTime: new Date(Date.now() - HOUR), trainerId: trainer.id } });
    const theirs = await prisma.class.create({ data: { name: "Theirs", startTime: new Date(Date.now() - HOUR), trainerId: other.id } });
    for (const c of [mine, theirs]) await prisma.classBooking.create({ data: { classId: c.id, memberId: m.id } });
    const mark = async (classId: string) => call(book.PATCH, await makeRequest("PATCH", "/x", { as: { staff: trainer }, body: { memberId: m.id, status: "ATTENDED" } }), { id: classId });
    expect((await mark(mine.id)).status).toBe(200);
    expect((await mark(theirs.id)).status).toBe(403);
  });
});

describe("timetable", () => {
  it("generates two weeks of classes from weekly slots, once", async () => {
    const owner = { staff: await createStaff("OWNER") };
    for (let weekday = 0; weekday < 7; weekday++) {
      await prisma.classTemplate.create({ data: { name: "Daily conditioning", weekday, startTime: "23:30", durationMinutes: 45, capacity: 12 } });
    }
    const first = await call(generate.POST, await makeRequest("POST", "/x", { as: owner, body: { weeks: 2 } }));
    expect(first.body.created).toBeGreaterThanOrEqual(13);
    expect(first.body.created).toBeLessThanOrEqual(14);
    const again = await call(generate.POST, await makeRequest("POST", "/x", { as: owner, body: { weeks: 2 } }));
    expect(again.body.created).toBe(0);
  });
});
