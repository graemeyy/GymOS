import { beforeEach, describe, expect, it } from "vitest";
import * as checkIn from "@/app/api/check-in/route";
import * as iot from "@/app/api/iot/checkin/route";
import * as cron from "@/app/api/cron/churn-shield/route";
import { resetEnvCacheForTests } from "@/lib/env";
import { call, createMember, createStaff, makeRequest, prisma, resetDb } from "../helpers";

beforeEach(resetDb);

describe("front-desk check-in", () => {
  it("is not reachable without a staff session (was public, audit S2)", async () => {
    const m = await createMember({ email: "secret.member@example.com" });
    const post = await call(checkIn.POST, await makeRequest("POST", "/api/check-in", { body: { query: m.email } }));
    expect(post.status).toBe(401);
    expect(JSON.stringify(post.body)).not.toContain("secret.member");
    expect((await call(checkIn.GET, await makeRequest("GET", "/api/check-in"))).status).toBe(401);
    expect(await prisma.checkIn.count()).toBe(0);
  });

  it("lets an active member in and records the visit", async () => {
    const desk = await createStaff("FRONT_DESK");
    const m = await createMember({ email: "in@example.com" });
    const res = await call(checkIn.POST, await makeRequest("POST", "/api/check-in", { as: { staff: desk }, body: { query: "IN@example.com" } }));
    expect(res.status).toBe(200);
    expect(res.body.granted).toBe(true);
    expect(await prisma.checkIn.count({ where: { memberId: m.id } })).toBe(1);
  });

  it("refuses a past-due member, doesn't count it as a visit, but logs it", async () => {
    const desk = await createStaff("FRONT_DESK");
    const m = await createMember({ status: "PAST_DUE" });
    const res = await call(checkIn.POST, await makeRequest("POST", "/api/check-in", { as: { staff: desk }, body: { query: m.id } }));
    expect(res.body).toMatchObject({ granted: false, reason: "Payment overdue" });
    expect(await prisma.checkIn.count({ where: { memberId: m.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "member.check_in_refused", targetId: m.id } })).toBe(1);
  });
});

describe("machine endpoints fail closed", () => {
  const withEnv = async (key: string, value: string | undefined, fn: () => Promise<void>) => {
    const before = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    resetEnvCacheForTests();
    try {
      await fn();
    } finally {
      process.env[key] = before;
      resetEnvCacheForTests();
    }
  };

  it("door gateway refuses everything when IOT_GATEWAY_SECRET is unset, including 'Bearer undefined'", async () => {
    const m = await createMember();
    await withEnv("IOT_GATEWAY_SECRET", undefined, async () => {
      const req = new Request("http://localhost/api/iot/checkin", { method: "POST", headers: { authorization: "Bearer undefined", "content-type": "application/json" }, body: JSON.stringify({ memberId: m.id }) });
      const res = await call(iot.POST, req);
      expect(res.status).toBe(503);
    });
    expect(await prisma.checkIn.count()).toBe(0);
  });

  it("door gateway rejects a wrong secret and accepts the right one", async () => {
    const m = await createMember();
    const send = (auth: string) =>
      call(iot.POST, new Request("http://localhost/api/iot/checkin", { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify({ memberId: m.id }) }));
    expect((await send("Bearer nope")).status).toBe(401);
    const ok = await send(`Bearer ${process.env.IOT_GATEWAY_SECRET}`);
    expect(ok.body).toMatchObject({ granted: true });
    expect(ok.body).not.toHaveProperty("email");
  });

  it("cron refuses when CRON_SECRET is unset or wrong, runs when right", async () => {
    await withEnv("CRON_SECRET", undefined, async () => {
      const res = await call(cron.GET, new Request("http://localhost/api/cron/churn-shield", { headers: { authorization: "Bearer undefined" } }));
      expect(res.status).toBe(503);
    });
    expect((await call(cron.GET, new Request("http://localhost/x", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    await createMember();
    const ok = await call(cron.GET, new Request("http://localhost/x", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    expect(ok.status).toBe(200);
    expect(ok.body.retentionUpdated).toBe(1);
  });
});
