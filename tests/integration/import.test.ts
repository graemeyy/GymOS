import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as preview from "@/app/api/import/preview/route";
import * as dryRun from "@/app/api/import/dry-run/route";
import * as run from "@/app/api/import/run/route";
import * as invites from "@/app/api/import/invites/route";
import * as checkout from "@/app/api/checkout/route";
import { resetPassword } from "@/lib/auth/password-reset";
import { applyDueTransitions } from "@/lib/membership/service";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import { MAIN_LOCATION_ID } from "@/lib/locations/constants";
import { addCalendarDays, localDateIn, zonedTimeToUtc } from "@/lib/dates";
import { gym } from "@/lib/config";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { installFakeStripe } from "../fake-stripe";

let owner: As;
const today = () => localDateIn(gym.business.timezone);

beforeEach(async () => {
  await resetDb();
  captureEmailsForTests(true);
  owner = { staff: await createStaff("OWNER") };
  await prisma.location.create({ data: { id: "north", name: "North", code: "north" } });
});
afterEach(() => captureEmailsForTests(false));

type Kind = "members" | "plans" | "memberships";
const upload = (kind: Kind, csv: string, fileName = `${kind}.csv`) => ({ kind, fileName, csv });

async function mapped(kind: Kind, csv: string, as: As = owner) {
  const res = await call(preview.POST, await makeRequest("POST", "/x", { as, body: upload(kind, csv) }));
  expect(res.status).toBe(200);
  return res.body.mapping as Record<string, number | null>;
}

async function check(kind: Kind, csv: string, mapping?: Record<string, number | null>) {
  const map = mapping ?? (await mapped(kind, csv));
  const res = await call(dryRun.POST, await makeRequest("POST", "/x", { as: owner, body: { ...upload(kind, csv), mapping: map } }));
  return { res, mapping: map, body: res.body as unknown as { readyCount: number; skippedCount: number; problemCount: number; problems: { line: number; field: string; message: string }[]; confirm: string | null; preview: Record<string, string>[] } };
}

async function importFile(kind: Kind, csv: string) {
  const { body, mapping } = await check(kind, csv);
  expect(body.problems).toEqual([]);
  return call(run.POST, await makeRequest("POST", "/x", { as: owner, body: { ...upload(kind, csv), mapping, confirm: body.confirm } }));
}

const MEMBERS = [
  "First name,Surname,E-mail,Club,Joined,Notes",
  "Asha,Patel,ASHA@example.com,North,01/03/2024,Prefers mornings",
  "Ben,Okoro,ben@example.com,,2023-11-20,",
].join("\n");

describe("who can import (D-130)", () => {
  it("is the owner's: Admin can't, unless a role is given data.import", async () => {
    const admin = { staff: await createStaff("ADMIN") };
    expect((await call(preview.POST, await makeRequest("POST", "/x", { as: admin, body: upload("members", MEMBERS) }))).status).toBe(403);
    expect((await call(invites.GET, await makeRequest("GET", "/x", { as: admin }))).status).toBe(403);
    const stored = await prisma.role.findUniqueOrThrow({ where: { id: "role_admin" } });
    expect(stored.permissions).not.toContain("data.import");
    expect((await prisma.role.findUniqueOrThrow({ where: { id: "role_owner" } })).permissions).toContain("data.import");
  });
});

describe("members", () => {
  it("guesses the column mapping from the headings", async () => {
    expect(await mapped("members", MEMBERS)).toEqual({ email: 2, name: null, firstName: 0, lastName: 1, homeLocation: 3, joinedOn: 4, notes: 5 });
  });

  it("checks every row in the dry run and changes nothing", async () => {
    await createMember({ email: "already@example.com" });
    const csv = [
      "Name,Email,Location,Joined",
      "Asha Patel,asha@example.com,North,2024-03-01",
      "No Email,,,",
      "Bad Email,not-an-email,,",
      "Twice,asha@example.com,,",
      "Somewhere,some@example.com,Atlantis,",
      `Future,future@example.com,,${addCalendarDays(today(), 30)}`,
      "Existing,already@example.com,,",
    ].join("\n");
    const before = await prisma.member.count();
    const { body } = await check("members", csv);
    expect(body.readyCount).toBe(1);
    expect(body.skippedCount).toBe(1);
    expect(body.problems.map((p) => [p.line, p.field, p.message])).toEqual([
      [3, "Email", "Every member needs an email address"],
      [4, "Email", "Not an email address"],
      [5, "Email", "The same email is on line 2"],
      [6, "Home location", "No open location has this name or code"],
      [7, "Member since", "This date is in the future"],
    ]);
    // Only a clean file can be imported.
    expect(body.confirm).toBeNull();
    expect(await prisma.member.count()).toBe(before);
  });

  it("refuses a run without a matching dry run", async () => {
    const { body, mapping } = await check("members", MEMBERS);
    const tampered = await call(run.POST, await makeRequest("POST", "/x", { as: owner, body: { ...upload("members", MEMBERS), mapping, confirm: "x".repeat(43) } }));
    expect(tampered.status).toBe(409);
    const changed = await call(run.POST, await makeRequest("POST", "/x", { as: owner, body: { ...upload("members", `${MEMBERS}\nCara,Lee,cara@example.com,,,`), mapping, confirm: body.confirm } }));
    expect(changed.status).toBe(409);
    // Someone else's dry run doesn't count either.
    const other = { staff: await createStaff("OWNER") };
    expect((await call(run.POST, await makeRequest("POST", "/x", { as: other, body: { ...upload("members", MEMBERS), mapping, confirm: body.confirm } }))).status).toBe(409);
    expect(await prisma.member.count({ where: { importedAt: { not: null } } })).toBe(0);
  });

  it("imports members, invites each to set a password, and audits once without their details", async () => {
    const res = await importFile("members", MEMBERS);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ imported: 2, skipped: 0, invites: { status: "sending", count: 2 } });

    const asha = await prisma.member.findUniqueOrThrow({ where: { email: "asha@example.com" }, include: { memberNotes: true } });
    expect(asha).toMatchObject({ name: "Asha Patel", status: "PENDING", homeLocationId: "north", passwordHash: null, emailVerifiedAt: null, stripeCustomerId: null });
    expect(asha.importedAt).not.toBeNull();
    expect(asha.createdAt.toISOString()).toBe(zonedTimeToUtc("2024-03-01", "00:00", gym.business.timezone).toISOString());
    expect(asha.memberNotes.map((n) => n.body)).toEqual(["Prefers mornings"]);
    expect((await prisma.member.findUniqueOrThrow({ where: { email: "ben@example.com" } })).homeLocationId).toBe(MAIN_LOCATION_ID);

    const audit = await prisma.auditLog.findMany({ where: { action: { startsWith: "import." } } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "import.members", details: { file: "members.csv", rows: 2, imported: 2, skipped: 0 } });
    expect(JSON.stringify(audit[0])).not.toContain("asha@example.com");

    const mail = capturedEmails().filter((m) => m.to === "asha@example.com");
    expect(mail).toHaveLength(1);
    expect(mail[0].text).toContain("weren't brought across");
    const token = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(mail[0].text)![1];
    // The invitation sets the password and confirms the email.
    await resetPassword(prisma, token, "a-brand-new-password");
    const after = await prisma.member.findUniqueOrThrow({ where: { email: "asha@example.com" } });
    expect(after.passwordHash).not.toBeNull();
    expect(after.emailVerifiedAt).not.toBeNull();

    // Importing the same file again changes nothing.
    const again = await check("members", MEMBERS);
    expect(again.body).toMatchObject({ readyCount: 0, skippedCount: 2, confirm: null });
  });

  it("lists imported members who haven't set a password, and sends them new links", async () => {
    await importFile("members", MEMBERS);
    expect((await call(invites.GET, await makeRequest("GET", "/x", { as: owner }))).body).toEqual({ awaitingPassword: 2, emailConfigured: true });
    const firstLink = /token=([A-Za-z0-9_-]+)/.exec(capturedEmails()[0].text)![1];
    const res = await call(invites.POST, await makeRequest("POST", "/x", { as: owner }));
    expect(res.body).toMatchObject({ status: "sending", count: 2 });
    // The old link no longer works.
    await expect(resetPassword(prisma, firstLink, "a-brand-new-password")).rejects.toThrow(/expired/);
    expect(await prisma.auditLog.count({ where: { action: "import.invites_resent" } })).toBe(1);
  });
});

describe("plans", () => {
  it("creates plans with prices, intervals, benefits and locations, and skips existing names", async () => {
    const csv = [
      "Plan,Price,Billing,Classes,Guest passes,Discount,Guest rate,Locations",
      "Flex,$24.95,Weekly,unlimited,1,10%,15,North",
      "Annual,1200,annual,,,,,all",
      "Standard,29.95,week,2,,,,",
    ].join("\n");
    const res = await importFile("plans", csv);
    expect(res.body).toMatchObject({ imported: 2, skipped: 1 });
    const flex = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "flex" }, include: { locations: true } });
    expect(flex).toMatchObject({ priceCents: 2495, interval: "WEEK", classCreditsPerCycle: null, guestPassesPerCycle: 1, shopDiscountPercent: 10, guestRateCents: 1500, locationAccess: "SELECTED" });
    expect(flex.locations.map((l) => l.locationId)).toEqual(["north"]);
    expect(await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "annual" } })).toMatchObject({ priceCents: 120000, interval: "YEAR", classCreditsPerCycle: 0, locationAccess: "ALL" });
  });

  it("explains bad prices and intervals", async () => {
    const { body } = await check("plans", "Name,Price,Interval\nOdd,free,daily");
    expect(body.problems.map((p) => p.field)).toEqual(["Price incl. GST", "Billed every"]);
  });
});

describe("memberships (D-131)", () => {
  const paidUntil = () => addCalendarDays(today(), 30);

  it("starts imported memberships, paid up to a date, without touching Stripe", async () => {
    await importFile("members", MEMBERS);
    const csv = ["Email,Plan,Paid until,Started,Status,Paused until", `asha@example.com,Unlimited,${paidUntil()},2024-03-01,active,`, `ben@example.com,standard,${paidUntil()},,paused,${addCalendarDays(today(), 14)}`].join("\n");
    const res = await importFile("memberships", csv);
    expect(res.body).toMatchObject({ imported: 2 });
    const asha = await prisma.member.findUniqueOrThrow({ where: { email: "asha@example.com" }, include: { membershipPlan: true, events: true } });
    expect(asha.status).toBe("ACTIVE");
    expect(asha.membershipPlan?.slug).toBe("unlimited");
    expect(asha.stripeSubscriptionId).toBeNull();
    // Paid to the end of that day.
    expect(asha.currentPeriodEnd?.toISOString()).toBe(zonedTimeToUtc(addCalendarDays(paidUntil(), 1), "00:00", gym.business.timezone).toISOString());
    expect(asha.membershipStartedAt?.toISOString()).toBe(zonedTimeToUtc("2024-03-01", "00:00", gym.business.timezone).toISOString());
    expect(asha.events.map((e) => [e.type, (e.details as { billing: string }).billing])).toEqual([["JOINED", "imported"]]);
    const ben = await prisma.member.findUniqueOrThrow({ where: { email: "ben@example.com" } });
    expect(ben.status).toBe("PAUSED");
    expect(ben.pausedUntil).not.toBeNull();
  });

  it("refuses unknown members, members already on a membership, and dates that have passed", async () => {
    const running = await createMember({ email: "running@example.com" });
    const csv = ["Email,Plan,Paid until", `nobody@example.com,Unlimited,${paidUntil()}`, `${running.email},Unlimited,${paidUntil()}`, `${running.email.replace("running", "x")},Nonexistent,2001-01-01`].join("\n");
    const { body } = await check("memberships", csv);
    expect(body.problems.map((p) => p.message)).toEqual([
      "No member has this email. Import members first",
      "This member already has a membership",
      "No member has this email. Import members first",
      "No plan has this name. Import plans first",
      "This date has passed. Take the payment first, or use today's date",
    ]);
  });

  it("is all or nothing: a change after the dry run stops the whole import", async () => {
    await importFile("members", MEMBERS);
    const csv = ["Email,Plan,Paid until", `asha@example.com,Unlimited,${paidUntil()}`, `ben@example.com,Unlimited,${paidUntil()}`].join("\n");
    const { body, mapping } = await check("memberships", csv);
    // Ben signs up online through Stripe in the meantime.
    await prisma.member.update({ where: { email: "ben@example.com" }, data: { status: "ACTIVE", stripeSubscriptionId: "sub_new" } });
    const res = await call(run.POST, await makeRequest("POST", "/x", { as: owner, body: { ...upload("memberships", csv), mapping, confirm: body.confirm } }));
    expect(res.status).toBe(409);
    expect((await prisma.member.findUniqueOrThrow({ where: { email: "asha@example.com" } })).status).toBe("PENDING");
    expect(await prisma.auditLog.count({ where: { action: "import.memberships" } })).toBe(0);
  });

  it("collects a card through Stripe that's first charged after the paid-up date", async () => {
    await importFile("members", MEMBERS);
    await importFile("memberships", `Email,Plan,Paid until\nasha@example.com,Unlimited,${paidUntil()}`);
    const asha = await prisma.member.update({ where: { email: "asha@example.com" }, data: { emailVerifiedAt: new Date() } });
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    const stripe = installFakeStripe();
    try {
      const res = await call(checkout.POST, await makeRequest("POST", "/x", { as: { member: asha }, body: { planId: plan.id, acceptTerms: true } }));
      expect(res.status).toBe(200);
      const session = stripe.calls.find((c) => c.method === "checkout.sessions.create")!.args[0] as { subscription_data: { trial_end?: number } };
      expect(session.subscription_data.trial_end).toBe(Math.floor(asha.currentPeriodEnd!.getTime() / 1000));
    } finally {
      stripe.restore();
    }
  });

  it("becomes overdue when the paid-up date passes without a card", async () => {
    await importFile("members", MEMBERS);
    await importFile("memberships", `Email,Plan,Paid until\nasha@example.com,Unlimited,${today()}`);
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    const result = await applyDueTransitions(prisma, new Date(Date.now() + 2 * 86_400_000));
    expect(result.importsLapsed).toBe(1);
    expect(await prisma.member.findUniqueOrThrow({ where: { email: "asha@example.com" } })).toMatchObject({ status: "PAST_DUE", amountOwingCents: plan.priceCents });
  });
});
