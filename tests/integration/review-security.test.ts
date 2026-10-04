// Regression tests for the security and privacy items in docs/REVIEW.md.
// Each test is named after its review ID and failed before the fix.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as login from "@/app/api/auth/login/route";
import * as memberLogin from "@/app/api/auth/member-login/route";
import * as bootstrap from "@/app/api/auth/bootstrap/route";
import * as memberById from "@/app/api/members/[id]/route";
import * as adminPlans from "@/app/api/admin/plans/route";
import * as staffPassword from "@/app/api/staff/me/password/route";
import { resetEnvCacheForTests } from "@/lib/env";
import { call, createMember, createStaff, makeRequest, prisma, resetDb } from "../helpers";

beforeEach(resetDb);
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

const from = (ip: string) => ({ "x-forwarded-for": ip });

describe("R-40 locking someone out of their account", () => {
  it("failed attempts from one address don't lock the owner out from another", async () => {
    await createStaff("OWNER", { email: "owner@example.com", password: "right-password-123" });
    for (let i = 0; i < 6; i++) {
      await call(login.POST, await makeRequest("POST", "/x", { body: { email: "owner@example.com", password: "guess" }, headers: from("203.0.113.9") }));
    }
    const owner = await call(login.POST, await makeRequest("POST", "/x", { body: { email: "owner@example.com", password: "right-password-123" }, headers: from("198.51.100.20") }));
    expect(owner.status).toBe(200);
  });

  it("successful sign-ins don't count towards the lockout", async () => {
    await createStaff("OWNER", { email: "busy@example.com", password: "right-password-123" });
    for (let i = 0; i < 6; i++) {
      const res = await call(login.POST, await makeRequest("POST", "/x", { body: { email: "busy@example.com", password: "right-password-123" }, headers: from("198.51.100.21") }));
      expect(res.status).toBe(200);
    }
  });
});

describe("R-41 shared Wi-Fi", () => {
  it("members signing in from the gym's address don't block staff sign-in from it", async () => {
    await createStaff("FRONT_DESK", { email: "desk@example.com", password: "right-password-123" });
    for (let i = 0; i < 11; i++) {
      await call(memberLogin.POST, await makeRequest("POST", "/x", { body: { email: `m${i}@example.com`, password: "whatever" }, headers: from("192.0.2.50") }));
    }
    const staff = await call(login.POST, await makeRequest("POST", "/x", { body: { email: "desk@example.com", password: "right-password-123" }, headers: from("192.0.2.50") }));
    expect(staff.status).toBe(200);
  });
});

describe("R-42 first-run setup", () => {
  const body = { name: "Owner", email: "first@example.com", password: "a-long-password-1" };

  it("needs the setup token when one is configured", async () => {
    vi.stubEnv("SETUP_TOKEN", "setup-token-for-tests-0123456789");
    resetEnvCacheForTests();
    expect((await call(bootstrap.GET, await makeRequest("GET", "/x"))).body).toMatchObject({ needsSetup: true, tokenRequired: true });
    expect((await call(bootstrap.POST, await makeRequest("POST", "/x", { body }))).status).toBe(403);
    expect((await call(bootstrap.POST, await makeRequest("POST", "/x", { body: { ...body, setupToken: "wrong-token-0123456789" } }))).status).toBe(403);
    expect((await call(bootstrap.POST, await makeRequest("POST", "/x", { body: { ...body, setupToken: "setup-token-for-tests-0123456789" } }))).status).toBe(201);
  });

  it("refuses in production when no setup token is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SETUP_TOKEN", "");
    resetEnvCacheForTests();
    const res = await call(bootstrap.POST, await makeRequest("POST", "/x", { body }));
    expect(res.status).toBe(503);
    expect(await prisma.staff.count()).toBe(0);
  });
});

describe("R-43 hiding revenue from front desk", () => {
  it("hides amounts owing and plan revenue as well as payments", async () => {
    await prisma.gymSettings.upsert({ where: { id: "singleton" }, update: { hideRevenueFromFrontDesk: true }, create: { id: "singleton", hideRevenueFromFrontDesk: true } });
    const desk = { staff: await createStaff("FRONT_DESK") };
    const m = await createMember({ status: "PAST_DUE" });
    await prisma.member.update({ where: { id: m.id }, data: { amountOwingCents: 3995, pastDueSince: new Date() } });
    const detail = await call(memberById.GET, await makeRequest("GET", "/x", { as: desk }), { id: m.id });
    expect(detail.body.amountOwingCents).toBeNull();
    const plans = await call(adminPlans.GET, await makeRequest("GET", "/x", { as: desk }));
    for (const p of plans.body as unknown as { memberCount: unknown }[]) expect(p.memberCount).toBeNull();
    // Managers still see everything.
    const manager = { staff: await createStaff("MANAGER") };
    expect((await call(memberById.GET, await makeRequest("GET", "/x", { as: manager }), { id: m.id })).body.amountOwingCents).toBe(3995);
  });
});

describe("R-45 staff password changes", () => {
  it("are rate limited, so a stolen session can't guess the current password", async () => {
    const staff = await createStaff("TRAINER", { password: "right-password-123" });
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await call(staffPassword.POST, await makeRequest("POST", "/x", { as: { staff }, body: { currentPassword: `guess-${i}`, newPassword: "a-brand-new-password" }, headers: from("203.0.113.77") }));
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});
