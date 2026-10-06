// R-34, D-119: check-in passes expire after 90 seconds and work once.
import { beforeEach, describe, expect, it } from "vitest";
import { call, createMember, createStaff, createStaffWith, makeRequest, prisma, resetDb, type As } from "../helpers";
import { createPassToken } from "@/lib/checkin/qr";
import { signPayload } from "@/lib/auth/token";
import * as checkIn from "@/app/api/check-in/route";
import * as search from "@/app/api/check-in/search/route";
import * as myPass from "@/app/api/me/pass/route";

let desk: As;

beforeEach(async () => {
  await resetDb();
  desk = { staff: await createStaff("FRONT_DESK") };
});

const scan = async (query: string) => call(checkIn.POST, await makeRequest("POST", "/api/check-in", { as: desk, body: { query } }));
const ago = (seconds: number) => new Date(Date.now() - seconds * 1000);

describe("scanning a pass", () => {
  it("lets the member in with the code on their screen now", async () => {
    const m = await createMember();
    const shown = await call(myPass.GET, await makeRequest("GET", "/x", { as: { member: m } }));
    const res = await scan(shown.body.token as string);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ granted: true, method: "QR", member: { id: m.id } });
    expect(await prisma.checkIn.count({ where: { memberId: m.id, method: "QR" } })).toBe(1);
  });

  it("refuses an expired code, such as a screenshot, and records the attempt", async () => {
    const m = await createMember();
    const { token } = await createPassToken(m.id, 0, ago(91));
    const res = await scan(token);
    expect(res.status).toBe(409);
    expect(res.body.error?.message).toBe("That pass has expired. Ask the member to open their pass in the app for a fresh code. Screenshots don't work.");
    expect(await prisma.checkIn.count()).toBe(0);
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "member.check_in_refused", targetId: m.id } });
    expect(entry.details).toMatchObject({ method: "QR", reason: "Expired pass" });
  });

  it("refuses a code that has already been used, even within its 90 seconds", async () => {
    const m = await createMember();
    const { token } = await createPassToken(m.id, 0, ago(10));
    expect((await scan(token)).body).toMatchObject({ granted: true });
    const again = await scan(token);
    expect(again.status).toBe(409);
    expect(again.body.error?.message).toContain("already been used");
    // An older code that was never scanned is refused too: it was on screen
    // before the one that let them in.
    expect((await scan((await createPassToken(m.id, 0, ago(30))).token)).status).toBe(409);
    // The next fresh code works.
    expect((await scan((await createPassToken(m.id, 0)).token)).body).toMatchObject({ granted: true });
    expect(await prisma.checkIn.count({ where: { memberId: m.id } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "member.check_in_refused", targetId: m.id } })).toBe(2);
  });

  it("lets only one of two simultaneous scans of the same code through", async () => {
    const m = await createMember();
    const { token } = await createPassToken(m.id, 0);
    const results = await Promise.all(Array.from({ length: 5 }, () => scan(token)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await prisma.checkIn.count({ where: { memberId: m.id } })).toBe(1);
  });

  it("refuses tampered codes without saying whose they were", async () => {
    const [m, other] = [await createMember(), await createMember()];
    const { token } = await createPassToken(m.id, 0);
    const [, body, sig] = token.split(".");
    const t = Math.floor(Date.now() / 1000);
    const forged = [
      `GYM2.${Buffer.from(JSON.stringify({ m: other.id, v: 0, t })).toString("base64url")}.${sig}`,
      `GYM2.${Buffer.from(JSON.stringify({ m: m.id, v: 0, t: t + 86_400 })).toString("base64url")}.${sig}`,
      `GYM2.${body}.${sig.slice(0, -2)}AA`,
      `GYM2.${await signPayload("session", { m: m.id, v: 0, t })}`,
    ];
    for (const code of forged) {
      const res = await scan(code);
      expect(res.status, code).toBe(404);
      expect(res.body.error?.message).toBe("That pass isn't valid.");
    }
    expect(await prisma.checkIn.count()).toBe(0);
  });

  it("refuses the old never-expiring passes with an explanation", async () => {
    const m = await createMember();
    const old = `GYM1.${await signPayload("qr", { m: m.id, v: 0 })}`;
    const res = await scan(old);
    expect(res.status).toBe(409);
    expect(res.body.error?.message).toContain("old pass that no longer works");
  });

  it("counts a scan as used even when entry is refused, so the code can't be passed on", async () => {
    const m = await createMember({ status: "PAUSED" });
    const { token } = await createPassToken(m.id, 0);
    expect((await scan(token)).body).toMatchObject({ granted: false, reason: "Membership paused" });
    await prisma.member.update({ where: { id: m.id }, data: { status: "ACTIVE" } });
    expect((await scan(token)).status).toBe(409);
  });
});

describe("when a pass won't scan", () => {
  it("staff can find the member by name and check them in by ID", async () => {
    const m = await createMember({ name: "Priya Raman" });
    await createMember({ name: "Sam Taylor" });
    const found = await call(search.GET, await makeRequest("GET", "/x?q=raman", { as: desk }));
    expect(found.status).toBe(200);
    const rows = found.body as unknown as { id: string; name: string }[];
    expect(rows.map((r) => r.name)).toEqual(["Priya Raman"]);
    expect((await scan(rows[0].id)).body).toMatchObject({ granted: true, method: "MANUAL", member: { id: m.id } });
  });

  it("keycards carry the member ID, which still checks in", async () => {
    const m = await createMember();
    expect((await scan(m.id)).body).toMatchObject({ granted: true, method: "MANUAL" });
  });

  it("never lists erased members, and needs the check-in permission", async () => {
    const m = await createMember({ name: "Erased Person" });
    await prisma.member.update({ where: { id: m.id }, data: { anonymisedAt: new Date() } });
    expect((await call(search.GET, await makeRequest("GET", "/x?q=erased", { as: desk }))).body).toEqual([]);
    const noScan = { staff: await createStaffWith(["members.view"]) };
    expect((await call(search.GET, await makeRequest("GET", "/x?q=erased", { as: noScan }))).status).toBe(403);
    expect((await call(search.GET, await makeRequest("GET", "/x?q=e", { as: desk }))).status).toBe(422);
  });
});
