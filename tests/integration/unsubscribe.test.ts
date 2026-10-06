// D-118: one-click unsubscribe from optional emails (Spam Act 2003).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { captureEmailsForTests, capturedEmails, type EmailMessage } from "@/lib/email";
import { createUnsubscribeToken, readUnsubscribeToken, unsubscribeLinks } from "@/lib/members/unsubscribe";
import { signPayload } from "@/lib/auth/token";
import { createPassToken } from "@/lib/checkin/qr";
import * as unsubscribe from "@/app/api/unsubscribe/route";
import * as announcements from "@/app/api/announcements/route";
import * as publish from "@/app/api/announcements/[id]/publish/route";
import * as book from "@/app/api/classes/[id]/book/route";
import * as waitlist from "@/app/api/classes/[id]/waitlist/route";
import * as resetRequest from "@/app/api/auth/password-reset/request/route";

let owner: As;
let n = 0;
const fresh = () => ({ "x-forwarded-for": `198.51.100.${(n++ % 250) + 1}` });

beforeEach(async () => {
  await resetDb();
  captureEmailsForTests(true);
  owner = { staff: await createStaff("OWNER") };
});
afterEach(() => captureEmailsForTests(false));

const tokenIn = (email: EmailMessage) => decodeURIComponent(email.text.match(/\/unsubscribe\?token=([^\s]+)/)?.[1] ?? "");
const describeLink = async (token: string) => call(unsubscribe.GET, await makeRequest("GET", `/api/unsubscribe?token=${encodeURIComponent(token)}`, { headers: fresh() }));
// The button on the page: a same-site POST with no body.
const pressButton = async (token: string) => call(unsubscribe.POST, await makeRequest("POST", `/api/unsubscribe?token=${encodeURIComponent(token)}`, { headers: fresh() }));
// A mail app's own Unsubscribe button: a form POST from the provider's
// servers, with no Origin and no cookie (RFC 8058).
async function oneClick(url: string) {
  const request = new Request(url.replace(/^https?:\/\/[^/]+/, "http://localhost:3000"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": fresh()["x-forwarded-for"] },
    body: "List-Unsubscribe=One-Click",
  });
  return call(unsubscribe.POST, request);
}

async function announce() {
  const created = await call(announcements.POST, await makeRequest("POST", "/x", { as: owner, body: { title: "Holiday hours", body: "Closed on Monday." } }));
  await call(publish.POST, await makeRequest("POST", "/x", { as: owner, body: { email: true } }), { id: String(created.body.id) });
}

describe("announcement emails", () => {
  it("carry an unsubscribe link and one-click headers for that member", async () => {
    const member = await createMember();
    await announce();
    const email = capturedEmails().find((e) => e.to === member.email)!;
    const token = tokenIn(email);
    expect(await readUnsubscribeToken(token)).toEqual({ m: member.id, t: "announcements" });
    expect(email.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(email.headers?.["List-Unsubscribe"]).toMatch(/^<https?:\/\/[^>]+\/api\/unsubscribe\?token=[^>]+>$/);
  });

  it("stop after the member unsubscribes from the page, which is audited once", async () => {
    const member = await createMember();
    const token = await createUnsubscribeToken(member.id, "announcements");
    const described = await describeLink(token);
    expect(described.status).toBe(200);
    expect(described.body).toMatchObject({ topic: "announcements", label: "gym news emails", subscribed: true });
    expect(described.body.email).not.toBe(member.email);

    expect((await pressButton(token)).body).toMatchObject({ changed: true });
    expect((await pressButton(token)).body).toMatchObject({ changed: false });
    const after = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect([after.notifyAnnouncements, after.notifyWaitlist]).toEqual([false, true]);
    const entries = await prisma.auditLog.findMany({ where: { action: "member.unsubscribed", targetId: member.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ details: { topic: "announcements", via: "page" }, before: { notifyAnnouncements: true }, after: { notifyAnnouncements: false } });
    expect(JSON.stringify(entries[0])).not.toContain(token);

    captureEmailsForTests(true);
    await announce();
    expect(capturedEmails().filter((e) => e.to === member.email)).toHaveLength(0);
  });

  it("can be stopped with the mail app's one-click button, without signing in", async () => {
    const member = await createMember();
    await announce();
    const header = capturedEmails().find((e) => e.to === member.email)!.headers!["List-Unsubscribe"];
    const res = await oneClick(header.slice(1, -1));
    expect(res.status).toBe(200);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).notifyAnnouncements).toBe(false);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: "member.unsubscribed" } })).details).toMatchObject({ via: "one-click" });
  });
});

describe("waitlist emails", () => {
  it("carry their own link, which only switches waitlist emails off", async () => {
    const desk = { staff: await createStaff("FRONT_DESK") };
    const cls = await prisma.class.create({ data: { name: "Conditioning", startTime: new Date(Date.now() + 86_400_000), capacity: 1 } });
    const [a, b] = [await createMember(), await createMember()];
    await call(book.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: a.id } }), { id: cls.id });
    await call(waitlist.POST, await makeRequest("POST", "/x", { as: desk, body: { memberId: b.id } }), { id: cls.id });
    await call(book.DELETE, await makeRequest("DELETE", `/x?memberId=${a.id}`, { as: desk }), { id: cls.id });

    const email = capturedEmails().find((e) => e.to === b.email)!;
    expect(email.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    await pressButton(tokenIn(email));
    const after = await prisma.member.findUniqueOrThrow({ where: { id: b.id } });
    expect([after.notifyWaitlist, after.notifyAnnouncements]).toEqual([false, true]);
  });
});

describe("unsubscribe links", () => {
  it("can't be forged, edited or moved to another member", async () => {
    const [victim, attacker] = [await createMember(), await createMember()];
    const mine = await createUnsubscribeToken(attacker.id, "announcements");
    const [body, sig] = mine.split(".");
    const swapped = Buffer.from(JSON.stringify({ m: victim.id, t: "announcements" })).toString("base64url");
    const tries = [
      `${swapped}.${sig}`, // someone else's member ID under my signature
      `${body}.${sig.slice(0, -2)}AA`, // a tampered signature
      await signPayload("session", { m: victim.id, t: "announcements" }), // signed for another purpose
      (await createPassToken(victim.id, 0)).token, // a check-in pass
      "not-a-token",
    ];
    for (const token of tries) {
      expect((await pressButton(token)).status, token).toBe(404);
      expect((await describeLink(token)).status, token).toBe(404);
    }
    expect((await prisma.member.findUniqueOrThrow({ where: { id: victim.id } })).notifyAnnouncements).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "member.unsubscribed" } })).toBe(0);
  });

  it("only work for the kind of email they came in", async () => {
    const member = await createMember();
    const [body, sig] = (await createUnsubscribeToken(member.id, "waitlist")).split(".");
    const other = Buffer.from(JSON.stringify({ m: member.id, t: "announcements" })).toString("base64url");
    expect((await pressButton(`${other}.${sig}`)).status).toBe(404);
    expect((await pressButton(`${body}.${sig}`)).status).toBe(200);
    const after = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect([after.notifyWaitlist, after.notifyAnnouncements]).toEqual([false, true]);
  });

  it("stop working once the member's details are erased", async () => {
    const member = await createMember();
    const token = await createUnsubscribeToken(member.id, "announcements");
    await prisma.member.update({ where: { id: member.id }, data: { anonymisedAt: new Date() } });
    expect((await pressButton(token)).status).toBe(404);
  });

  it("are rate limited per address", async () => {
    const member = await createMember();
    const token = await createUnsubscribeToken(member.id, "announcements");
    const headers = { "x-forwarded-for": "203.0.113.77" };
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await call(unsubscribe.GET, await makeRequest("GET", `/api/unsubscribe?token=${encodeURIComponent(token)}`, { headers }))).status;
    expect(last).toBe(429);
  });
});

describe("account emails", () => {
  it("have no unsubscribe link and still arrive when every optional email is off", async () => {
    const member = await createMember();
    await prisma.member.update({ where: { id: member.id }, data: { notifyAnnouncements: false, notifyWaitlist: false } });
    await call(resetRequest.POST, await makeRequest("POST", "/x", { body: { kind: "member", email: member.email }, headers: fresh() }));
    const reset = capturedEmails().find((e) => e.to === member.email);
    expect(reset?.text).toContain("/reset-password?token=");
    expect(reset?.headers).toBeUndefined();
    expect(reset?.text).not.toMatch(/unsubscribe/i);
  });

  it("links are absolute and point at this site", async () => {
    const member = await createMember();
    const links = await unsubscribeLinks(member.id, "announcements");
    expect(links.page).toMatch(/^https?:\/\/[^/]+\/unsubscribe\?token=/);
  });
});
