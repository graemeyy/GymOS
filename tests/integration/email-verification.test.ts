// D-113, D-114: online sign-ups confirm their email before paying online.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { hashAuthToken } from "@/lib/auth/auth-tokens";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import * as signup from "@/app/api/auth/member-signup/route";
import * as me from "@/app/api/me/route";
import * as resend from "@/app/api/me/email-verification/route";
import * as verify from "@/app/api/auth/verify-email/route";
import * as checkout from "@/app/api/checkout/route";
import * as shopCheckout from "@/app/api/shop/checkout/route";
import * as members from "@/app/api/members/route";
import * as announcements from "@/app/api/announcements/route";
import * as publish from "@/app/api/announcements/[id]/publish/route";

beforeEach(async () => {
  await resetDb();
  captureEmailsForTests(true);
});
afterEach(() => captureEmailsForTests(false));

let n = 0;
const fresh = () => ({ "x-forwarded-for": `192.0.2.${(n++ % 250) + 1}` });
const tokenFor = (email: string) => capturedEmails().filter((e) => e.to === email).at(-1)?.text.match(/token=([\w-]+)/)?.[1] ?? "";
const confirm = async (token: string) => call(verify.POST, await makeRequest("POST", "/x", { body: { token }, headers: fresh() }));

async function signUp(email = "new.person@example.com") {
  const res = await call(signup.POST, await makeRequest("POST", "/x", { body: { name: "New Person", email, password: "a-long-password-1", acceptTerms: true }, headers: fresh() }));
  expect(res.status).toBe(201);
  const member = await prisma.member.findUniqueOrThrow({ where: { email } });
  return { member, as: { member } as As };
}

describe("signing up online", () => {
  it("emails a confirmation link and starts unconfirmed", async () => {
    const { member, as } = await signUp();
    const token = tokenFor(member.email);
    expect(capturedEmails().at(-1)?.text).toContain(`/verify-email?token=${token}`);
    expect((await prisma.authToken.findFirstOrThrow({ where: { memberId: member.id } })).tokenHash).toBe(hashAuthToken(token));
    expect((await call(me.GET, await makeRequest("GET", "/x", { as }))).body.emailVerifiedAt).toBeNull();
  });

  it("confirming once sets the date; the link doesn't work again", async () => {
    const { member, as } = await signUp();
    const token = tokenFor(member.email);
    expect((await confirm(token)).status).toBe(200);
    expect((await call(me.GET, await makeRequest("GET", "/x", { as }))).body.emailVerifiedAt).not.toBeNull();
    expect((await confirm(token)).status).toBe(404);
  });

  it("links expire after 24 hours", async () => {
    const { member } = await signUp();
    const token = tokenFor(member.email);
    const row = await prisma.authToken.findFirstOrThrow({ where: { memberId: member.id } });
    expect(Math.abs(row.expiresAt.getTime() - row.createdAt.getTime() - 24 * 3_600_000)).toBeLessThan(1000);
    await prisma.authToken.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await confirm(token)).status).toBe(404);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).emailVerifiedAt).toBeNull();
  });

  it("a link for an address the member no longer has confirms nothing", async () => {
    const { member } = await signUp();
    const token = tokenFor(member.email);
    await prisma.member.update({ where: { id: member.id }, data: { email: "other@example.com" } });
    expect((await confirm(token)).status).toBe(404);
  });
});

describe("sending the link again", () => {
  it("replaces the previous link", async () => {
    const { member, as } = await signUp();
    const first = tokenFor(member.email);
    expect((await call(resend.POST, await makeRequest("POST", "/x", { as, headers: fresh() }))).status).toBe(200);
    const second = tokenFor(member.email);
    expect(second).not.toBe(first);
    expect((await confirm(first)).status).toBe(404);
    expect((await confirm(second)).status).toBe(200);
  });

  it("allows three an hour", async () => {
    const { as } = await signUp();
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await call(resend.POST, await makeRequest("POST", "/x", { as, headers: fresh() }))).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("refuses once confirmed", async () => {
    const { member, as } = await signUp();
    await confirm(tokenFor(member.email));
    expect((await call(resend.POST, await makeRequest("POST", "/x", { as, headers: fresh() }))).status).toBe(409);
  });

  it("confirming is rate limited per address", async () => {
    const headers = { "x-forwarded-for": "203.0.113.50" };
    const statuses = [];
    for (let i = 0; i < 22; i++) statuses.push((await call(verify.POST, await makeRequest("POST", "/x", { body: { token: `made-up-token-${i}-xxxxxxxxxx` }, headers }))).status);
    expect(statuses.slice(0, 20).every((s) => s === 404)).toBe(true);
    expect(statuses).toContain(429);
  });
});

describe("what an unconfirmed member can't do (D-114)", () => {
  it("can't start a membership or a shop checkout", async () => {
    const { as } = await signUp();
    const plan = await prisma.membershipPlan.findFirstOrThrow({ where: { active: true } });
    const membership = await call(checkout.POST, await makeRequest("POST", "/x", { as, body: { planId: plan.id, acceptTerms: true } }));
    expect(membership.status).toBe(403);
    expect(membership.body.error?.code).toBe("email_unverified");
    const shop = await call(shopCheckout.POST, await makeRequest("POST", "/x", { as, body: { lines: [{ variantId: "x", quantity: 1 }], fulfilment: "PICKUP" } }));
    expect(shop.body.error?.code).toBe("email_unverified");
  });

  it("gets past that check once confirmed", async () => {
    const { member, as } = await signUp();
    await confirm(tokenFor(member.email));
    const plan = await prisma.membershipPlan.findFirstOrThrow({ where: { active: true } });
    const membership = await call(checkout.POST, await makeRequest("POST", "/x", { as, body: { planId: plan.id, acceptTerms: true } }));
    expect(membership.body.error?.code).not.toBe("email_unverified");
  });

  it("isn't sent announcement emails", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const confirmed = await createMember({ email: "confirmed@example.com" });
    const unconfirmed = await createMember({ email: "unconfirmed@example.com", emailVerified: false });
    const created = await call(announcements.POST, await makeRequest("POST", "/x", { as: owner, body: { title: "Holiday hours", body: "Closed on Monday." } }));
    await call(publish.POST, await makeRequest("POST", "/x", { as: owner, body: { email: true } }), { id: String(created.body.id) });
    const recipients = capturedEmails().map((e) => e.to);
    expect(recipients).toContain(confirmed.email);
    expect(recipients).not.toContain(unconfirmed.email);
  });

  it("members added by staff count as confirmed", async () => {
    const owner = { staff: await createStaff("OWNER") };
    await call(members.POST, await makeRequest("POST", "/x", { as: owner, body: { name: "Desk Signup", email: "desk.signup@example.com" } }));
    expect((await prisma.member.findUniqueOrThrow({ where: { email: "desk.signup@example.com" } })).emailVerifiedAt).not.toBeNull();
  });
});

describe("the audit log", () => {
  it("records sending and confirming, never the token", async () => {
    const { member } = await signUp();
    const token = tokenFor(member.email);
    await confirm(token);
    const entries = await prisma.auditLog.findMany({ where: { targetId: member.id }, orderBy: { createdAt: "asc" } });
    expect(entries.map((e) => e.action)).toEqual(["member.signed_up", "member.email_verification_sent", "member.email_verified"]);
    expect(JSON.stringify(entries)).not.toContain(token);
  });
});
