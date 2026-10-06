import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Db, Tx } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { zEmail } from "@/lib/http/route";
import { env } from "@/lib/env";
import { gym } from "@/lib/config";
import { logAction } from "@/lib/audit";
import { addCalendarDays, localDateIn, zonedTimeToUtc } from "@/lib/dates";
import { appUrl } from "@/lib/app-url";
import { hashAuthToken } from "@/lib/auth/auth-tokens";
import { emailConfigured, sendEmail, signature } from "@/lib/email";
import { emailLinksMayShowOnScreen, runAfterResponse } from "@/lib/email/links";
import { getBranding } from "@/lib/branding/service";
import { slugify } from "@/lib/shop/products";
import { MAIN_LOCATION_ID } from "@/lib/locations/constants";
import { CsvError, parseCsv, type ParsedCsv } from "./csv";
import { IMPORT_FIELDS, suggestMapping, type ImportKind } from "./fields";
import { parseClassCredits, parseCount, parseDate, parseInterval, parseMoney, parseStatus, type Interval } from "./values";
import { MAX_IMPORT_ROWS, type ImportDryRunInput, type ImportRunInput } from "./schema";

// CSV import of members, plans and memberships (D-130, D-131). Every row is
// checked first; the import itself is all or nothing, and only runs after a
// dry run of exactly the same file and column mapping.

export interface Problem {
  line: number;
  field: string;
  value: string;
  message: string;
}
export interface Skip {
  line: number;
  reason: string;
}

type Mapping = Record<string, number | null>;
type Row = ParsedCsv["rows"][number];

const INVITE_DAYS = 14;
const SHOWN_PROBLEMS = 2000;
const SHOWN_SKIPS = 500;

function readCsv(csv: string): ParsedCsv {
  try {
    const parsed = parseCsv(csv);
    if (parsed.rows.length > MAX_IMPORT_ROWS) throw new ApiError("validation_failed", `The file has ${parsed.rows.length} rows. Import at most ${MAX_IMPORT_ROWS} at a time.`, { csv: "Too many rows" });
    if (parsed.rows.length === 0) throw new ApiError("validation_failed", "The file has headings but no rows.", { csv: "No rows" });
    return parsed;
  } catch (error) {
    if (error instanceof CsvError) throw new ApiError("validation_failed", `The file isn't a CSV that can be read: ${error.message}`, { csv: error.message });
    throw error;
  }
}

/** The headings, the first few rows and a first guess at the mapping. */
export function previewImport(kind: ImportKind, csv: string) {
  const parsed = readCsv(csv);
  return { headers: parsed.headers, sample: parsed.rows.slice(0, 5).map((r) => r.cells), rowCount: parsed.rows.length, mapping: suggestMapping(kind, parsed.headers) };
}

function checkMapping(kind: ImportKind, mapping: Mapping, headers: string[]) {
  const fields: Record<string, string> = {};
  for (const field of IMPORT_FIELDS[kind]) {
    const column = mapping[field.key];
    if (column !== null && column !== undefined && column >= headers.length) fields[field.key] = "That column isn't in the file";
    else if (field.required && (column === null || column === undefined)) fields[field.key] = `Choose the column for ${field.label.toLowerCase()}`;
  }
  if (kind === "members" && mapping.name == null && mapping.firstName == null && mapping.lastName == null) fields.name = "Choose the column for the name, or for first and last name";
  if (Object.keys(fields).length) throw new ApiError("validation_failed", "Some columns still need choosing.", fields);
}

const cellOf = (row: Row, mapping: Mapping, key: string) => {
  const column = mapping[key];
  return column === null || column === undefined ? "" : (row.cells[column] ?? "").trim();
};
const labelOf = (kind: ImportKind, key: string) => IMPORT_FIELDS[kind].find((f) => f.key === key)?.label ?? key;

// Gym-local midnight at the start of a date.
const startOf = (date: string) => zonedTimeToUtc(date, "00:00", gym.business.timezone);
const today = () => localDateIn(gym.business.timezone);

async function openLocations(db: Db | Tx) {
  const rows = await db.location.findMany({ where: { archivedAt: null }, select: { id: true, name: true, code: true } });
  return (value: string) => {
    const v = value.trim().toLowerCase();
    return rows.find((l) => l.name.toLowerCase() === v || l.code === v || l.id === v) ?? null;
  };
}

// ---------- Members ----------

interface MemberRow {
  line: number;
  email: string;
  name: string;
  homeLocationId: string;
  homeLocation: string;
  joinedOn: string | null;
  note: string | null;
}

async function planMembers(db: Db | Tx, parsed: ParsedCsv, mapping: Mapping) {
  const findLocation = await openLocations(db);
  const problems: Problem[] = [];
  const skipped: Skip[] = [];
  const ready: MemberRow[] = [];
  const emails = parsed.rows.map((r) => cellOf(r, mapping, "email").toLowerCase()).filter(Boolean);
  const existing = new Set((await db.member.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((m) => m.email));
  const seen = new Map<string, number>();
  for (const row of parsed.rows) {
    const issue = (key: string, value: string, message: string) => problems.push({ line: row.line, field: labelOf("members", key), value, message });
    const before = problems.length;
    const rawEmail = cellOf(row, mapping, "email");
    const email = zEmail.safeParse(rawEmail);
    if (!rawEmail) issue("email", "", "Every member needs an email address");
    else if (!email.success) issue("email", rawEmail, "Not an email address");
    const name = cellOf(row, mapping, "name") || [cellOf(row, mapping, "firstName"), cellOf(row, mapping, "lastName")].filter(Boolean).join(" ");
    if (!name) issue("name", "", "Every member needs a name");
    else if (name.length > 120) issue("name", name.slice(0, 40), "Names can be at most 120 characters");
    const locationValue = cellOf(row, mapping, "homeLocation");
    const location = locationValue ? findLocation(locationValue) : null;
    if (locationValue && !location) issue("homeLocation", locationValue, "No open location has this name or code");
    const joinedValue = cellOf(row, mapping, "joinedOn");
    const joinedOn = joinedValue ? parseDate(joinedValue) : null;
    if (joinedValue && !joinedOn) issue("joinedOn", joinedValue, "Not a date. Use 2024-03-01 or 01/03/2024");
    else if (joinedOn && joinedOn > today()) issue("joinedOn", joinedValue, "This date is in the future");
    const note = cellOf(row, mapping, "notes");
    if (note.length > 2000) issue("notes", note.slice(0, 40), "Notes can be at most 2,000 characters");
    if (problems.length > before || !email.success) continue;
    const address = email.data;
    if (seen.has(address)) {
      issue("email", rawEmail, `The same email is on line ${seen.get(address)}`);
      continue;
    }
    seen.set(address, row.line);
    if (existing.has(address)) {
      skipped.push({ line: row.line, reason: `${address} is already a member` });
      continue;
    }
    ready.push({ line: row.line, email: address, name, homeLocationId: location?.id ?? MAIN_LOCATION_ID, homeLocation: location?.name ?? "", joinedOn, note: note || null });
  }
  return { problems, skipped, ready };
}

// ---------- Plans ----------

interface PlanRow {
  line: number;
  name: string;
  slug: string;
  priceCents: number;
  interval: Interval;
  description: string | null;
  classCreditsPerCycle: number | null;
  guestPassesPerCycle: number;
  shopDiscountPercent: number;
  guestRateCents: number;
  locationAccess: "ALL" | "HOME" | "SELECTED";
  locationIds: string[];
}

async function planPlans(db: Db | Tx, parsed: ParsedCsv, mapping: Mapping) {
  const findLocation = await openLocations(db);
  const problems: Problem[] = [];
  const skipped: Skip[] = [];
  const ready: PlanRow[] = [];
  const existing = new Set((await db.membershipPlan.findMany({ select: { slug: true } })).map((p) => p.slug));
  const seen = new Map<string, number>();
  for (const row of parsed.rows) {
    const issue = (key: string, value: string, message: string) => problems.push({ line: row.line, field: labelOf("plans", key), value, message });
    const before = problems.length;
    const name = cellOf(row, mapping, "name");
    const slug = slugify(name);
    if (!name) issue("name", "", "Every plan needs a name");
    else if (name.length > 120 || !slug) issue("name", name.slice(0, 40), "Use a name of up to 120 characters, with letters or numbers");
    const priceValue = cellOf(row, mapping, "price");
    const priceCents = parseMoney(priceValue);
    if (priceCents === null || priceCents === 0) issue("price", priceValue, "Not a price. Use dollars, such as 29.95");
    const intervalValue = cellOf(row, mapping, "interval");
    const interval = parseInterval(intervalValue);
    if (!interval) issue("interval", intervalValue, "Use week, fortnight, month or year");
    const description = cellOf(row, mapping, "description");
    if (description.length > 500) issue("description", description.slice(0, 40), "At most 500 characters");
    const creditsValue = cellOf(row, mapping, "classCredits");
    const credits = parseClassCredits(creditsValue);
    if (credits === "invalid") issue("classCredits", creditsValue, "A number up to 1,000, or 'unlimited'");
    const guestValue = cellOf(row, mapping, "guestPasses");
    const guestPasses = parseCount(guestValue, 100);
    if (guestPasses === null) issue("guestPasses", guestValue, "A whole number up to 100");
    const discountValue = cellOf(row, mapping, "shopDiscount").replace(/%$/, "");
    const discount = parseCount(discountValue, 100);
    if (discount === null) issue("shopDiscount", discountValue, "A whole number from 0 to 100");
    const rateValue = cellOf(row, mapping, "guestRate");
    const guestRate = rateValue ? parseMoney(rateValue) : 0;
    if (guestRate === null) issue("guestRate", rateValue, "Not an amount. Use dollars, such as 20.00");
    const locationsValue = cellOf(row, mapping, "locations");
    let locationAccess: PlanRow["locationAccess"] = "ALL";
    const locationIds: string[] = [];
    if (/^home( location)?( only)?$/i.test(locationsValue)) locationAccess = "HOME";
    else if (locationsValue && !/^(all|every|any)( locations)?$/i.test(locationsValue)) {
      locationAccess = "SELECTED";
      for (const part of locationsValue.split(";").map((p) => p.trim()).filter(Boolean)) {
        const found = findLocation(part);
        if (found) locationIds.push(found.id);
        else issue("locations", part, "No open location has this name or code");
      }
    }
    if (problems.length > before) continue;
    if (seen.has(slug)) {
      issue("name", name, `The same plan is on line ${seen.get(slug)}`);
      continue;
    }
    seen.set(slug, row.line);
    if (existing.has(slug)) {
      skipped.push({ line: row.line, reason: `A plan called ${name} already exists` });
      continue;
    }
    ready.push({
      line: row.line,
      name,
      slug,
      priceCents: priceCents!,
      interval: interval!,
      description: description || null,
      classCreditsPerCycle: credits as number | null,
      guestPassesPerCycle: guestPasses!,
      shopDiscountPercent: discount!,
      guestRateCents: guestRate!,
      locationAccess,
      locationIds,
    });
  }
  return { problems, skipped, ready };
}

// ---------- Memberships ----------

interface MembershipRow {
  line: number;
  memberId: string;
  email: string;
  planId: string;
  plan: string;
  paidUntil: string;
  startedOn: string;
  status: "ACTIVE" | "PAUSED";
  pausedUntil: string | null;
  importedAt: Date | null;
  onboardedAt: Date | null;
}

async function planMemberships(db: Db | Tx, parsed: ParsedCsv, mapping: Mapping) {
  const problems: Problem[] = [];
  const ready: MembershipRow[] = [];
  const emails = parsed.rows.map((r) => cellOf(r, mapping, "email").toLowerCase()).filter(Boolean);
  const members = new Map(
    (
      await db.member.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true, status: true, planId: true, stripeSubscriptionId: true, archivedAt: true, anonymisedAt: true, importedAt: true, onboardedAt: true },
      })
    ).map((m) => [m.email, m])
  );
  const plans = await db.membershipPlan.findMany({ select: { id: true, name: true, slug: true } });
  const findPlan = (value: string) => plans.find((p) => p.name.toLowerCase() === value.toLowerCase() || p.slug === value.toLowerCase()) ?? null;
  const now = today();
  const latest = addCalendarDays(now, 731);
  const seen = new Map<string, number>();
  for (const row of parsed.rows) {
    const issue = (key: string, value: string, message: string) => problems.push({ line: row.line, field: labelOf("memberships", key), value, message });
    const before = problems.length;
    const rawEmail = cellOf(row, mapping, "email");
    const email = rawEmail.toLowerCase();
    const member = members.get(email);
    if (!rawEmail) issue("email", "", "Every row needs the member's email");
    else if (!member) issue("email", rawEmail, "No member has this email. Import members first");
    else if (member.archivedAt || member.anonymisedAt) issue("email", rawEmail, "This member is archived");
    else if (member.stripeSubscriptionId && member.status !== "CANCELED") issue("email", rawEmail, "This member already pays through Stripe");
    else if (member.status !== "PENDING" && member.status !== "CANCELED") issue("email", rawEmail, "This member already has a membership");
    else if (seen.has(email)) issue("email", rawEmail, `The same member is on line ${seen.get(email)}`);
    const planValue = cellOf(row, mapping, "plan");
    const plan = planValue ? findPlan(planValue) : null;
    if (!plan) issue("plan", planValue, planValue ? "No plan has this name. Import plans first" : "Every row needs a plan");
    const paidValue = cellOf(row, mapping, "paidUntil");
    const paidUntil = parseDate(paidValue);
    if (!paidUntil) issue("paidUntil", paidValue, "Not a date. Use 2024-03-01 or 01/03/2024");
    else if (paidUntil < now) issue("paidUntil", paidValue, "This date has passed. Take the payment first, or use today's date");
    else if (paidUntil > latest) issue("paidUntil", paidValue, "More than two years away. Check the date");
    const startedValue = cellOf(row, mapping, "startedOn");
    const startedOn = startedValue ? parseDate(startedValue) : now;
    if (!startedOn) issue("startedOn", startedValue, "Not a date. Use 2024-03-01 or 01/03/2024");
    else if (startedOn > now) issue("startedOn", startedValue, "This date is in the future");
    const statusValue = cellOf(row, mapping, "status");
    const status = parseStatus(statusValue);
    if (!status) issue("status", statusValue, "Use 'active' or 'paused'. Leave cancelled memberships out");
    const pausedValue = cellOf(row, mapping, "pausedUntil");
    const pausedUntil = pausedValue ? parseDate(pausedValue) : null;
    if (pausedValue && !pausedUntil) issue("pausedUntil", pausedValue, "Not a date. Use 2024-03-01 or 01/03/2024");
    else if (status === "PAUSED" && !pausedUntil) issue("pausedUntil", "", "Paused memberships need the date the pause ends");
    else if (status === "PAUSED" && pausedUntil && pausedUntil <= now) issue("pausedUntil", pausedValue, "This date has passed. Import the membership as active");
    if (problems.length > before || !member || !plan) continue;
    seen.set(email, row.line);
    ready.push({
      line: row.line,
      memberId: member.id,
      email,
      planId: plan.id,
      plan: plan.name,
      paidUntil: paidUntil!,
      startedOn: startedOn!,
      status: status!,
      pausedUntil: status === "PAUSED" ? pausedUntil : null,
      importedAt: member.importedAt,
      onboardedAt: member.onboardedAt,
    });
  }
  return { problems, skipped: [] as Skip[], ready };
}

// ---------- Dry run and run ----------

async function planImport(db: Db | Tx, input: ImportDryRunInput) {
  const parsed = readCsv(input.csv);
  checkMapping(input.kind, input.mapping, parsed.headers);
  const planned = input.kind === "members" ? await planMembers(db, parsed, input.mapping) : input.kind === "plans" ? await planPlans(db, parsed, input.mapping) : await planMemberships(db, parsed, input.mapping);
  return { total: parsed.rows.length, ...planned };
}

// Ties a run to the dry run that checked it: an HMAC of who, which kind, the
// mapping and the file, so only this server could have issued it.
function confirmToken(staff: StaffActor, input: ImportDryRunInput) {
  const mapping = Object.keys(input.mapping)
    .sort()
    .map((k) => `${k}=${input.mapping[k]}`)
    .join("&");
  const file = createHash("sha256").update(input.csv).digest("hex");
  return createHmac("sha256", env().SESSION_SECRET).update(`import\n${staff.id}\n${input.kind}\n${mapping}\n${file}`).digest("base64url");
}

// What a ready row will become, for the dry run's preview table.
function describe(kind: ImportKind, row: MemberRow | PlanRow | MembershipRow): Record<string, string> {
  if (kind === "members") {
    const m = row as MemberRow;
    return { Line: String(m.line), Name: m.name, Email: m.email, "Home location": m.homeLocation || "Main location", "Member since": m.joinedOn ?? "" };
  }
  if (kind === "plans") {
    const p = row as PlanRow;
    return { Line: String(p.line), Plan: p.name, Price: `$${(p.priceCents / 100).toFixed(2)}`, "Billed every": p.interval.toLowerCase(), Classes: p.classCreditsPerCycle === null ? "Unlimited" : String(p.classCreditsPerCycle) };
  }
  const s = row as MembershipRow;
  return { Line: String(s.line), Email: s.email, Plan: s.plan, Status: s.status === "PAUSED" ? `Paused until ${s.pausedUntil}` : "Active", "Paid until": s.paidUntil };
}

export async function dryRunImport(db: Db, staff: StaffActor, input: ImportDryRunInput) {
  const plan = await planImport(db, input);
  return {
    kind: input.kind,
    fileName: input.fileName,
    total: plan.total,
    readyCount: plan.ready.length,
    preview: plan.ready.slice(0, 10).map((r) => describe(input.kind, r)),
    skippedCount: plan.skipped.length,
    skipped: plan.skipped.slice(0, SHOWN_SKIPS),
    problemCount: plan.problems.length,
    problems: plan.problems.slice(0, SHOWN_PROBLEMS),
    // Only a clean file can be imported.
    confirm: plan.problems.length === 0 && plan.ready.length > 0 ? confirmToken(staff, input) : null,
  };
}

function sameToken(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

interface Invite {
  email: string;
  name: string;
  token: string;
}

export async function runImport(db: Db, staff: StaffActor, input: ImportRunInput) {
  const { confirm, ...dryRun } = input;
  if (!sameToken(confirm, confirmToken(staff, dryRun))) throw new ApiError("conflict", "Run the dry run again: the file or the columns changed since it was checked.");
  const invites: Invite[] = [];
  const result = await db.$transaction(
    async (tx) => {
      // Checked again inside the transaction: someone may have added a
      // member or plan since the dry run.
      const plan = await planImport(tx, dryRun);
      if (plan.problems.length) throw new ApiError("conflict", "The file has problems now that it didn't have in the dry run. Run the dry run again to see them.");
      if (plan.ready.length === 0) throw new ApiError("conflict", "There's nothing new to import.");
      const now = new Date();
      if (input.kind === "members") invites.push(...(await createMembers(tx, staff, plan.ready as MemberRow[], now)));
      else if (input.kind === "plans") await createPlans(tx, plan.ready as PlanRow[]);
      else await startMemberships(tx, staff, plan.ready as MembershipRow[], now);
      // One audit entry for the whole import, without anyone's details.
      await logAction(tx, staff, {
        action: `import.${input.kind}`,
        targetType: "Import",
        details: { file: input.fileName, rows: plan.total, imported: plan.ready.length, skipped: plan.skipped.length },
      });
      return { imported: plan.ready.length, skipped: plan.skipped.length };
    },
    { timeout: 120_000, maxWait: 10_000 }
  );
  return { kind: input.kind, ...result, invites: input.kind === "members" ? await sendInvites(invites) : null };
}

async function createMembers(tx: Tx, staff: StaffActor, rows: MemberRow[], now: Date): Promise<Invite[]> {
  await tx.member.createMany({
    data: rows.map((r) => ({
      email: r.email,
      name: r.name,
      status: "PENDING" as const,
      homeLocationId: r.homeLocationId,
      importedAt: now,
      createdAt: r.joinedOn ? startOf(r.joinedOn) : now,
    })),
  });
  const created = await tx.member.findMany({ where: { email: { in: rows.map((r) => r.email) } }, select: { id: true, email: true } });
  const idOf = new Map(created.map((m) => [m.email, m.id]));
  const notes = rows.filter((r) => r.note);
  if (notes.length) await tx.memberNote.createMany({ data: notes.map((r) => ({ memberId: idOf.get(r.email)!, staffName: staff.name, body: r.note! })) });
  // The invitation is a set-password link: using it confirms the email and
  // signs them in (D-112, D-113).
  const invites = rows.map((r) => ({ email: r.email, name: r.name, token: randomBytes(32).toString("base64url") }));
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000);
  await tx.authToken.createMany({ data: invites.map((i) => ({ tokenHash: hashAuthToken(i.token), purpose: "PASSWORD_RESET" as const, memberId: idOf.get(i.email)!, email: i.email, expiresAt })) });
  return invites;
}

async function createPlans(tx: Tx, rows: PlanRow[]) {
  const max = (await tx.membershipPlan.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
  for (const [i, { line: _line, locationIds, ...fields }] of rows.entries()) {
    await tx.membershipPlan.create({ data: { ...fields, sortOrder: max + i + 1, locations: { create: locationIds.map((locationId) => ({ locationId })) } } });
  }
}

async function startMemberships(tx: Tx, staff: StaffActor, rows: MembershipRow[], now: Date) {
  for (const r of rows) {
    const started = startOf(r.startedOn);
    await tx.member.update({
      where: { id: r.memberId },
      data: {
        planId: r.planId,
        status: r.status,
        membershipStartedAt: started,
        // Paid up to the end of that day; Stripe billing starts after it.
        currentPeriodEnd: startOf(addCalendarDays(r.paidUntil, 1)),
        pausedFrom: r.status === "PAUSED" ? now : null,
        pausedUntil: r.pausedUntil ? startOf(r.pausedUntil) : null,
        importedAt: r.importedAt ?? now,
        onboardedAt: r.onboardedAt ?? now,
        cancelAt: null,
        cancelledAt: null,
        cancelReason: null,
        pendingPlanId: null,
      },
    });
  }
  await tx.membershipEvent.createMany({
    data: rows.map((r) => ({ memberId: r.memberId, type: "JOINED" as const, effectiveAt: startOf(r.startedOn), details: { plan: r.plan, billing: "imported", paidUntil: r.paidUntil }, actorName: staff.name })),
  });
}

// ---------- Invitations ----------

async function inviteMessage(invite: Invite) {
  const brand = await getBranding();
  const first = invite.name.split(" ")[0] || "there";
  const link = appUrl(`/reset-password?token=${invite.token}`);
  return {
    link,
    message: {
      to: invite.email,
      subject: `Set up your ${brand.appName} account`,
      text: `Hi ${first},\n\n${brand.name} now uses ${brand.appName} for memberships, class bookings and your entry pass. Your account is ready: choose a password here to sign in.\n\n${link}\n\nThe link works once, for ${INVITE_DAYS} days. After that, use "Forgot password" on the sign-in page.\n\nYour card details weren't brought across, so you'll be asked to add a card when you sign in.${await signature()}`,
    },
  };
}

// After the response, so a large import doesn't wait on thousands of emails.
// Without email, nothing is sent; outside production the first links come
// back for the screen instead (D-115).
async function sendInvites(invites: Invite[]): Promise<{ status: "sending" | "not_sent"; count: number; previewLinks: { email: string; link: string }[] }> {
  if (invites.length === 0) return { status: "sending", count: 0, previewLinks: [] };
  if (!emailConfigured()) {
    const previewLinks = emailLinksMayShowOnScreen() ? await Promise.all(invites.slice(0, 20).map(async (i) => ({ email: i.email, link: (await inviteMessage(i)).link }))) : [];
    return { status: "not_sent", count: invites.length, previewLinks };
  }
  await runAfterResponse(async () => {
    for (const invite of invites) await sendEmail((await inviteMessage(invite)).message);
  });
  return { status: "sending", count: invites.length, previewLinks: [] };
}

/** Imported members who haven't chosen a password yet. */
export async function importStatus(db: Db) {
  const awaitingPassword = await db.member.count({ where: { importedAt: { not: null }, passwordHash: null, archivedAt: null, anonymisedAt: null } });
  return { awaitingPassword, emailConfigured: emailConfigured() };
}

// New links for every imported member who hasn't set a password, replacing
// their old ones.
export async function resendInvites(db: Db, staff: StaffActor) {
  const members = await db.member.findMany({ where: { importedAt: { not: null }, passwordHash: null, archivedAt: null, anonymisedAt: null }, select: { id: true, email: true, name: true } });
  if (members.length === 0) throw new ApiError("conflict", "Every imported member has already set a password.");
  if (!emailConfigured()) throw new ApiError("conflict", "Email isn't set up yet, so invitations can't be sent. Add RESEND_API_KEY and EMAIL_FROM first.");
  const invites = members.map((m) => ({ email: m.email, name: m.name ?? "", token: randomBytes(32).toString("base64url") }));
  await db.$transaction(
    async (tx) => {
      const now = new Date();
      await tx.authToken.updateMany({ where: { memberId: { in: members.map((m) => m.id) }, purpose: "PASSWORD_RESET", usedAt: null }, data: { usedAt: now } });
      const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000);
      await tx.authToken.createMany({ data: invites.map((i, n) => ({ tokenHash: hashAuthToken(i.token), purpose: "PASSWORD_RESET" as const, memberId: members[n].id, email: i.email, expiresAt })) });
      await logAction(tx, staff, { action: "import.invites_resent", targetType: "Import", details: { count: invites.length } });
    },
    { timeout: 60_000 }
  );
  return sendInvites(invites);
}
