import { beforeEach, describe, expect, it } from "vitest";
import * as book from "@/app/api/classes/[id]/book/route";
import * as waitlist from "@/app/api/classes/[id]/waitlist/route";
import * as promote from "@/app/api/classes/[id]/waitlist/promote/route";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";

let desk: As;

beforeEach(async () => {
  await resetDb();
  desk = { staff: await createStaff("FRONT_DESK") };
});

async function newClass(capacity: number) {
  return prisma.class.create({ data: { name: "Conditioning", startTime: new Date(Date.now() + 86_400_000), capacity } });
}

describe("class booking", () => {
  it("never overbooks when many people grab the last spot at once", async () => {
    const cls = await newClass(1);
    const people = await Promise.all(Array.from({ length: 8 }, () => createMember()));
    const results = await Promise.all(
      people.map(async (m) => call(book.POST, await makeRequest("POST", `/api/classes/${cls.id}/book`, { as: desk, body: { memberId: m.id } }), { id: cls.id }))
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    expect(await prisma.classBooking.count({ where: { classId: cls.id } })).toBe(1);
  });

  it("sends people to the waitlist when full and promotes them when a spot opens", async () => {
    const cls = await newClass(1);
    const [a, b] = [await createMember(), await createMember()];
    expect((await call(book.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: a.id } }), { id: cls.id })).status).toBe(201);
    expect((await call(book.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: b.id } }), { id: cls.id })).status).toBe(409);
    expect((await call(waitlist.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: b.id } }), { id: cls.id })).status).toBe(201);
    expect((await call(promote.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: b.id } }), { id: cls.id })).status).toBe(409);
    expect((await call(book.DELETE, await makeRequest("DELETE", `/x?memberId=${a.id}`, { as: desk }), { id: cls.id })).status).toBe(200);
    expect((await call(promote.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: b.id } }), { id: cls.id })).status).toBe(201);
    expect(await prisma.classWaitlist.count({ where: { classId: cls.id } })).toBe(0);
  });

  it("refuses to book an archived member", async () => {
    const cls = await newClass(5);
    const m = await createMember();
    await prisma.member.update({ where: { id: m.id }, data: { archivedAt: new Date() } });
    expect((await call(book.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: m.id } }), { id: cls.id })).status).toBe(409);
  });

  it("rejects invalid input with field errors", async () => {
    const cls = await newClass(5);
    const res = await call(book.PATCH, await makeRequest("PATCH", "/x", { as: desk, body: { memberId: "x", status: "TELEPORTED" } }), { id: cls.id });
    expect(res.status).toBe(422);
    expect(res.body.error?.fields).toHaveProperty("status");
  });
});
