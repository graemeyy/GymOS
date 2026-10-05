// D-112: forgotten passwords. Single-use links stored only as a hash,
// 60 minutes, rate limited, no account enumeration, every session ends.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call, createMember, createStaff, makeRequest, prisma, resetDb } from "../helpers";
import { hashPassword } from "@/lib/auth/password";
import { hashAuthToken } from "@/lib/auth/auth-tokens";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import { resetEnvCacheForTests } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth/token";
import * as requestReset from "@/app/api/auth/password-reset/request/route";
import * as reset from "@/app/api/auth/password-reset/route";
import * as authMe from "@/app/api/auth/me/route";
import * as memberLogin from "@/app/api/auth/member-login/route";

beforeEach(resetDb);
afterEach(() => {
  captureEmailsForTests(false);
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

let ipCounter = 0;
// Each test gets its own address, so per-address limits don't carry over.
const ip = () => `198.51.100.${(ipCounter++ % 250) + 1}`;
const ask = async (kind: "staff" | "member", email: string, from = ip()) =>
  call(requestReset.POST, await makeRequest("POST", "/x", { body: { kind, email }, headers: { "x-forwarded-for": from } }));
const tokenFrom = (text: string) => text.match(/token=([\w-]+)/)?.[1] ?? "";
const linkFor = (email: string) => tokenFrom(capturedEmails().filter((e) => e.to === email).at(-1)?.text ?? "");
const choose = async (token: string, password: string) => call(reset.POST, await makeRequest("POST", "/x", { body: { token, password }, headers: { "x-forwarded-for": ip() } }));

function asProduction() {
  vi.stubEnv("VERCEL_ENV", "production");
  resetEnvCacheForTests();
}

describe("asking for a reset link", () => {
  it("answers the same whether or not the email has an account (production)", async () => {
    asProduction();
    const member = await createMember({ password: "old-password-123" });
    const staff = await createStaff("MANAGER");
    const answers = await Promise.all([ask("member", member.email), ask("member", "nobody@example.com"), ask("staff", staff.email), ask("staff", member.email)]);
    for (const a of answers) {
      expect(a.status).toBe(200);
      expect(a.body).toEqual({ ok: true });
    }
  });

  it("emails a single-use link and stores only its hash", async () => {
    captureEmailsForTests(true);
    const member = await createMember({ password: "old-password-123" });
    await ask("member", member.email);
    const token = linkFor(member.email);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(capturedEmails().at(-1)?.text).toContain(`/reset-password?token=${token}`);
    const rows = await prisma.authToken.findMany({ where: { memberId: member.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashAuthToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(Math.abs(rows[0].expiresAt.getTime() - rows[0].createdAt.getTime() - 60 * 60_000)).toBeLessThan(1000);
  });

  it("sends staff to the staff reset page", async () => {
    captureEmailsForTests(true);
    const staff = await createStaff("TRAINER");
    await ask("staff", staff.email);
    expect(capturedEmails().at(-1)?.text).toContain("/admin/reset-password?token=");
  });

  it("does nothing for unknown emails, deactivated staff or archived members", async () => {
    captureEmailsForTests(true);
    const staff = await createStaff("TRAINER");
    await prisma.staff.update({ where: { id: staff.id }, data: { deactivatedAt: new Date() } });
    const member = await createMember();
    await prisma.member.update({ where: { id: member.id }, data: { archivedAt: new Date() } });
    await ask("staff", staff.email);
    await ask("member", member.email);
    await ask("member", "nobody@example.com");
    expect(capturedEmails()).toHaveLength(0);
    expect(await prisma.authToken.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: { contains: "password_reset" } } })).toBe(0);
  });

  it("shows the link on screen outside production when email isn't set up, never on production", async () => {
    const member = await createMember();
    const dev = await ask("member", member.email);
    expect(String(dev.body.previewLink)).toMatch(/\/reset-password\?token=/);
    asProduction();
    expect((await ask("member", member.email)).body).toEqual({ ok: true });
  });

  it("a new link replaces the previous one", async () => {
    captureEmailsForTests(true);
    const member = await createMember({ password: "old-password-123" });
    await ask("member", member.email);
    const first = linkFor(member.email);
    await ask("member", member.email);
    const second = linkFor(member.email);
    expect(second).not.toBe(first);
    expect((await choose(first, "new-password-456")).status).toBe(404);
    expect((await choose(second, "new-password-456")).status).toBe(200);
  });

  it("sends at most three links an hour per account, without saying so", async () => {
    captureEmailsForTests(true);
    const member = await createMember();
    const answers = [];
    for (let i = 0; i < 5; i++) answers.push(await ask("member", member.email));
    expect(answers.every((a) => a.status === 200 && JSON.stringify(a.body) === '{"ok":true}')).toBe(true);
    expect(capturedEmails().filter((e) => e.to === member.email)).toHaveLength(3);
  });

  it("is rate limited per address", async () => {
    const from = ip();
    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await ask("member", `someone${i}@example.com`, from)).status);
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses).toContain(429);
  });
});

describe("using a reset link", () => {
  it("sets the password, signs this browser in and every other session out", async () => {
    captureEmailsForTests(true);
    const member = await createMember({ password: "old-password-123" });
    const oldSession = { member };
    expect((await call(authMe.GET, await makeRequest("GET", "/x", { as: oldSession }))).status).toBe(200);
    await ask("member", member.email);
    const token = linkFor(member.email);
    expect((await call(reset.GET, await makeRequest("GET", `/x?token=${token}`))).body).toEqual({ kind: "member" });

    const res = await choose(token, "brand-new-password-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=`);
    expect((await call(authMe.GET, await makeRequest("GET", "/x", { as: oldSession }))).status).toBe(401);
    const signIn = await call(memberLogin.POST, await makeRequest("POST", "/x", { body: { email: member.email, password: "brand-new-password-1" }, headers: { "x-forwarded-for": ip() } }));
    expect(signIn.status).toBe(200);
  });

  it("works once", async () => {
    captureEmailsForTests(true);
    const member = await createMember({ password: "old-password-123" });
    await ask("member", member.email);
    const token = linkFor(member.email);
    expect((await choose(token, "brand-new-password-1")).status).toBe(200);
    const again = await choose(token, "another-password-2");
    expect(again.status).toBe(404);
    expect((await call(reset.GET, await makeRequest("GET", `/x?token=${token}`))).status).toBe(404);
  });

  it("two uses at the same moment can't both succeed", async () => {
    captureEmailsForTests(true);
    const member = await createMember({ password: "old-password-123" });
    await ask("member", member.email);
    const token = linkFor(member.email);
    const results = await Promise.all([choose(token, "first-password-123"), choose(token, "second-password-456")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
  });

  it("expires after 60 minutes", async () => {
    captureEmailsForTests(true);
    const member = await createMember({ password: "old-password-123" });
    await ask("member", member.email);
    const token = linkFor(member.email);
    await prisma.authToken.updateMany({ where: { memberId: member.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call(reset.GET, await makeRequest("GET", `/x?token=${token}`))).status).toBe(404);
    expect((await choose(token, "brand-new-password-1")).status).toBe(404);
    const unchanged = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(unchanged.sessionVersion).toBe(member.sessionVersion);
  });

  it("stops working if the account is deactivated or its email changes", async () => {
    captureEmailsForTests(true);
    const staff = await createStaff("MANAGER");
    await ask("staff", staff.email);
    const token = linkFor(staff.email);
    await prisma.staff.update({ where: { id: staff.id }, data: { deactivatedAt: new Date() } });
    expect((await choose(token, "brand-new-password-1")).status).toBe(404);

    const member = await createMember();
    await ask("member", member.email);
    const memberToken = linkFor(member.email);
    await prisma.member.update({ where: { id: member.id }, data: { email: "changed@example.com" } });
    expect((await choose(memberToken, "brand-new-password-1")).status).toBe(404);
  });

  it("counts as choosing their own password, and confirms a member's email", async () => {
    captureEmailsForTests(true);
    const member = await createMember({ emailVerified: false });
    await prisma.member.update({ where: { id: member.id }, data: { mustChangePassword: true, passwordHash: await hashPassword("given-password-1") } });
    await ask("member", member.email);
    await choose(linkFor(member.email), "brand-new-password-1");
    const after = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(after.mustChangePassword).toBe(false);
    expect(after.emailVerifiedAt).not.toBeNull();
  });

  it("lets a member added at the desk set their first password", async () => {
    captureEmailsForTests(true);
    const member = await createMember();
    expect(member.passwordHash).toBeNull();
    await ask("member", member.email);
    expect((await choose(linkFor(member.email), "my-first-password-1")).status).toBe(200);
  });

  it("is rate limited per address", async () => {
    const from = "203.0.113.9";
    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await call(reset.POST, await makeRequest("POST", "/x", { body: { token: `not-a-real-token-${i}-xxxxxxxx`, password: "whatever-1234" }, headers: { "x-forwarded-for": from } }))).status);
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(statuses).toContain(429);
  });
});

describe("the audit log", () => {
  it("records the request and the reset, never the token", async () => {
    captureEmailsForTests(true);
    const staff = await createStaff("MANAGER");
    await ask("staff", staff.email);
    const token = linkFor(staff.email);
    await choose(token, "brand-new-password-1");
    const entries = await prisma.auditLog.findMany({ where: { targetId: staff.id }, orderBy: { createdAt: "asc" } });
    expect(entries.map((e) => [e.action, e.staffName])).toEqual([
      ["staff.password_reset_requested", "Password reset request"],
      ["staff.password_reset", staff.name],
    ]);
    expect(JSON.stringify(entries)).not.toContain(token);
  });
});
