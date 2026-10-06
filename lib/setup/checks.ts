import type { Db } from "@/lib/db";
import { APP_URL_VARIABLE, explicitAppUrl } from "@/lib/app-url";
import type { GymConfig } from "@/lib/config/schema";

// `npm run check:setup` (D-132): is this copy of GymOS ready for a gym? It
// looks at whether each setting is present and the right shape, never at
// what a secret says, and never prints one. Findings are worded for the
// person setting up the gym, with what to do next.

export interface Finding {
  level: "ok" | "note" | "warn" | "fail";
  area: string;
  message: string;
}

type Env = Record<string, string | undefined>;

// Values copied from .env.example or the docs, which mean "not set yet".
const PLACEHOLDERS = [/^replace-with/i, /^changeme$/i, /^your[-_ ]/i, /example/i, /^x+$/i];
const isPlaceholder = (value: string) => PLACEHOLDERS.some((p) => p.test(value));

export function checkEnvironment(env: Env): Finding[] {
  const findings: Finding[] = [];
  const add = (level: Finding["level"], area: string, message: string) => findings.push({ level, area, message });
  const production = env.VERCEL_ENV === "production" || env.NODE_ENV === "production";

  // Database
  const db = env.DATABASE_URL ?? "";
  if (!db) add("fail", "Database", "DATABASE_URL isn't set. Use the connection string for this copy's own Production database.");
  else if (!/^postgres(ql)?:\/\//.test(db)) add("fail", "Database", "DATABASE_URL isn't a postgres:// connection string.");
  else if (/@(localhost|127\.0\.0\.1)[:/]/.test(db) && production) add("fail", "Database", "DATABASE_URL points at this computer, not a hosted database.");
  else add("ok", "Database", "DATABASE_URL is set.");

  // Sessions and the first owner
  const session = env.SESSION_SECRET ?? "";
  if (!session) add("fail", "Security", "SESSION_SECRET isn't set. Generate one with: openssl rand -base64 48");
  else if (session.length < 32) add("fail", "Security", "SESSION_SECRET is shorter than 32 characters. Generate one with: openssl rand -base64 48");
  else if (isPlaceholder(session)) add("fail", "Security", "SESSION_SECRET is still the placeholder from .env.example. Generate a real one.");
  else add("ok", "Security", "SESSION_SECRET is set and long enough.");
  if (env.SHOW_EMAIL_LINKS === "true" && production) add("fail", "Security", "SHOW_EMAIL_LINKS is true. Remove it: it's for local test builds only.");

  // Address
  const url = explicitAppUrl(env) ?? "";
  if (!url) add(production ? "warn" : "note", "Domain", `${APP_URL_VARIABLE} isn't set, so links in emails use the Vercel address. Set it to the gym's custom domain, such as https://members.yourgym.com.au.`);
  else if (!/^https:\/\//.test(url) && production) add("fail", "Domain", `${APP_URL_VARIABLE} should start with https://.`);
  else if (/vercel\.app/.test(url)) add("warn", "Domain", `${APP_URL_VARIABLE} is a vercel.app address. Set up the gym's custom domain and use that.`);
  else if (isPlaceholder(url)) add("fail", "Domain", `${APP_URL_VARIABLE} is still a placeholder.`);
  else add("ok", "Domain", `${APP_URL_VARIABLE} is set.`);

  // Stripe
  const key = env.STRIPE_SECRET_KEY ?? "";
  const live = /^(sk|rk)_live_/.test(key);
  if (!key) add("fail", "Stripe", "STRIPE_SECRET_KEY isn't set. Use the secret key from this gym's own Stripe account.");
  else if (!/^(sk|rk)_(test|live)_/.test(key)) add("fail", "Stripe", "STRIPE_SECRET_KEY doesn't look like a Stripe secret key.");
  else if (live && env.STRIPE_ALLOW_LIVE_KEYS !== "true") add("fail", "Stripe", "STRIPE_SECRET_KEY is a live key but STRIPE_ALLOW_LIVE_KEYS isn't true, so it will be refused.");
  else if (live) add("ok", "Stripe", "STRIPE_SECRET_KEY is a live key, and live keys are allowed. Real cards will be charged.");
  else add(production ? "warn" : "ok", "Stripe", `STRIPE_SECRET_KEY is a test-mode key${production ? ", so no real money will be taken. Switch to live keys when the gym is ready" : ""}.`);
  const whsec = env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!whsec) add("fail", "Stripe", "STRIPE_WEBHOOK_SECRET isn't set. Add a webhook endpoint in Stripe and copy its signing secret.");
  else if (!whsec.startsWith("whsec_")) add("fail", "Stripe", "STRIPE_WEBHOOK_SECRET doesn't look like a webhook signing secret (whsec_...).");
  else add("ok", "Stripe", "STRIPE_WEBHOOK_SECRET is set. Run npm run stripe:check -- --remote to check the endpoint sends the right events.");

  // Email
  const resend = env.RESEND_API_KEY ?? "";
  const from = env.EMAIL_FROM ?? "";
  if (!resend) add("fail", "Email", "RESEND_API_KEY isn't set, so no email is sent: no password resets, invitations or receipts.");
  else if (!resend.startsWith("re_")) add("warn", "Email", "RESEND_API_KEY doesn't look like a Resend key (re_...).");
  else add("ok", "Email", "RESEND_API_KEY is set.");
  const fromAddress = /<([^<>\s]+@[^<>\s]+)>/.exec(from)?.[1] ?? (from.includes("@") ? from.trim() : "");
  if (!from) add("fail", "Email", "EMAIL_FROM isn't set. Use an address on the gym's own domain, verified in Resend.");
  else if (!fromAddress) add("fail", "Email", "EMAIL_FROM has no email address in it.");
  else if (/\.example$|example\.(com|org)$|yourgym/i.test(fromAddress)) add("fail", "Email", "EMAIL_FROM is still the placeholder address.");
  else add("ok", "Email", `EMAIL_FROM sends from the ${fromAddress.split("@")[1]} domain. That domain must be verified in Resend.`);

  // Jobs, doors and setup
  if (!env.CRON_SECRET) add("fail", "Daily job", "CRON_SECRET isn't set, so the daily job (renewals, pauses, reminders, timetable) is refused.");
  else if (env.CRON_SECRET.length < 16) add("fail", "Daily job", "CRON_SECRET is shorter than 16 characters.");
  else add("ok", "Daily job", "CRON_SECRET is set.");
  if (!env.IOT_GATEWAY_SECRET) add("note", "Doors", "IOT_GATEWAY_SECRET isn't set. That's fine unless the gym has door scanners.");
  else if (env.IOT_GATEWAY_SECRET.length < 16) add("fail", "Doors", "IOT_GATEWAY_SECRET is shorter than 16 characters.");
  else add("ok", "Doors", "IOT_GATEWAY_SECRET is set.");
  if (env.ALLOW_PREVIEW_MIGRATIONS === "true" && env.VERCEL_ENV === "production") add("note", "Database", "ALLOW_PREVIEW_MIGRATIONS is set on production, where it does nothing. Set it only on Preview, with Preview's own database.");
  return findings;
}

// The first owner: SETUP_TOKEN is needed until there's an owner, and not after.
export function checkSetupToken(env: Env, hasOwner: boolean | null): Finding[] {
  const token = env.SETUP_TOKEN ?? "";
  if (hasOwner === true) return [token ? { level: "note", area: "First owner", message: "An owner account exists. SETUP_TOKEN is no longer needed; you can remove it." } : { level: "ok", area: "First owner", message: "An owner account exists." }];
  if (!token) return [{ level: "fail", area: "First owner", message: "There's no owner yet and SETUP_TOKEN isn't set, so /admin/setup will refuse. Generate one with: openssl rand -base64 24" }];
  if (token.length < 16) return [{ level: "fail", area: "First owner", message: "SETUP_TOKEN is shorter than 16 characters." }];
  return [{ level: hasOwner === false ? "warn" : "ok", area: "First owner", message: hasOwner === false ? "SETUP_TOKEN is set. Open /admin/setup and create the owner account." : "SETUP_TOKEN is set." }];
}

// The gym's details in config/gym.config.json. Branding can be changed later
// in the app; the legal details and policies can't.
export function checkConfig(gym: GymConfig): Finding[] {
  const findings: Finding[] = [];
  if (gym.isDemo) findings.push({ level: "fail", area: "Gym details", message: "config/gym.config.json still says isDemo: true. Put in the gym's real details, then set it to false." });
  else findings.push({ level: "ok", area: "Gym details", message: `config/gym.config.json is for ${gym.business.legalName}.` });
  if (/\.example$/.test(gym.business.email)) findings.push({ level: "fail", area: "Gym details", message: "The contact email is on a placeholder domain." });
  if (gym.plans.length === 0) findings.push({ level: "warn", area: "Gym details", message: "No starting plans in the config. Add them there, or on the Plans page or by import." });
  return findings;
}

// What's in the database: migrations, the owner, branding, plans, locations,
// and no demo accounts. Read only.
export async function checkDatabase(db: Db, migrationNames: string[]): Promise<{ findings: Finding[]; hasOwner: boolean }> {
  const findings: Finding[] = [];
  const add = (level: Finding["level"], area: string, message: string) => findings.push({ level, area, message });

  const applied = await db.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  const done = new Set(applied.filter((m) => m.finished_at && !m.rolled_back_at).map((m) => m.migration_name));
  const failed = applied.filter((m) => !m.finished_at && !m.rolled_back_at);
  const missing = migrationNames.filter((n) => !done.has(n));
  if (failed.length) add("fail", "Database", `${failed.length} migration(s) failed part-way. See docs/MERGE-PLAN.md before going further.`);
  if (missing.length) add("fail", "Database", `${missing.length} migration(s) not applied yet, the newest ${missing[missing.length - 1]}. A production deploy applies them; locally run npm run db:migrate.`);
  if (!failed.length && !missing.length) add("ok", "Database", `All ${migrationNames.length} migrations are applied.`);

  const owners = await db.staff.count({ where: { deactivatedAt: null, assignedRole: { isOwner: true } } });
  const demoStaff = await db.staff.count({ where: { email: { endsWith: "@example.com" } } });
  const demoMembers = await db.member.count({ where: { email: { endsWith: "@example.com" } } });
  if (demoStaff || demoMembers) add("fail", "Database", `Demo accounts are in this database (${demoStaff} staff, ${demoMembers} members on example.com). Never seed a gym's database; start again from an empty one.`);

  const branding = await db.branding.findUnique({ where: { id: "singleton" }, select: { name: true, logoType: true } });
  if (!branding) add("warn", "Branding", "Branding hasn't been saved yet, so the app shows the config defaults. The owner should check it on the Branding page.");
  else add(branding.logoType ? "ok" : "note", "Branding", branding.logoType ? "Branding is saved, with a logo." : "Branding is saved, without a logo yet.");

  const plans = await db.membershipPlan.count({ where: { active: true } });
  if (plans === 0) add("fail", "Plans", "There are no plans members can join. Add them on the Plans page or import them.");
  else add("ok", "Plans", `${plans} plan(s) open for sign-up.`);

  const main = await db.location.findUnique({ where: { id: "main" }, select: { name: true, addressLine1: true } });
  if (main && (!main.addressLine1 || main.name === "Main location")) add("warn", "Locations", "The main location has no name or address yet. Set them on the Locations page; pickup emails use them.");
  else if (main) add("ok", "Locations", `${await db.location.count({ where: { archivedAt: null } })} location(s) set up.`);

  const events = await db.stripeEvent.count();
  add(events ? "ok" : "note", "Stripe", events ? "Stripe has delivered webhook events here." : "No Stripe webhook event has arrived yet. Make a test payment once the endpoint is set up.");
  return { findings, hasOwner: owners > 0 };
}

/** The report as text: one line per finding, grouped by area. No values. */
export function formatFindings(findings: Finding[]): string {
  const mark = { ok: "OK  ", note: "NOTE", warn: "WARN", fail: "FAIL" } as const;
  const areas = [...new Set(findings.map((f) => f.area))];
  return areas.map((area) => [`${area}`, ...findings.filter((f) => f.area === area).map((f) => `  ${mark[f.level]}  ${f.message}`)].join("\n")).join("\n\n");
}
