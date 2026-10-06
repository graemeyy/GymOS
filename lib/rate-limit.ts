import { prisma, type Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";

export interface RateLimitRule {
  // Bucket name, e.g. "login". Combined with the caller key.
  name: string;
  limit: number;
  windowSeconds: number;
}

// Fixed-window counter in Postgres, so the limit holds across serverless
// instances. One atomic upsert per call.
export async function hitRateLimit(rule: RateLimitRule, callerKey: string, db: Db = prisma, now = new Date()) {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const key = `${rule.name}:${callerKey}`.slice(0, 200);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" = EXCLUDED."windowStart" THEN "RateLimit"."count" + 1 ELSE 1 END,
      "windowStart" = EXCLUDED."windowStart"
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  return { allowed: count <= rule.limit, count, retryAfterSeconds: Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000) };
}

export async function enforceRateLimit(rule: RateLimitRule, callerKey: string, db: Db = prisma) {
  const result = await hitRateLimit(rule, callerKey, db);
  if (!result.allowed) {
    throw new ApiError("rate_limited", `Too many attempts. Try again in ${Math.max(1, Math.ceil(result.retryAfterSeconds / 60))} minute(s).`);
  }
}

// Per-account sign-in lockout. Only failed attempts count, and the key
// includes the caller's address, so someone guessing from elsewhere can't
// lock the real person out (R-40).
export async function signInLocked(rule: RateLimitRule, callerKey: string, db: Db = prisma, now = new Date()): Promise<boolean> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const row = await db.rateLimit.findUnique({ where: { key: `${rule.name}:${callerKey}`.slice(0, 200) } });
  return Boolean(row && row.windowStart.getTime() === windowStart.getTime() && row.count >= rule.limit);
}

export async function recordFailedSignIn(rule: RateLimitRule, callerKey: string, db: Db = prisma) {
  await hitRateLimit(rule, callerKey, db);
}

export async function assertSignInAllowed(rule: RateLimitRule, callerKey: string, db: Db = prisma) {
  if (await signInLocked(rule, callerKey, db)) {
    throw new ApiError("rate_limited", "Too many wrong passwords. Try again in 15 minutes, or reset it with the gym.");
  }
}

// The caller's address for rate limiting. On Vercel the platform sets
// x-forwarded-for to the real client address; behind another proxy, make sure
// it overwrites (not appends to) this header, or limits can be dodged (R-41).
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export const RATE_LIMITS = {
  // Staff and members have separate per-address limits, so members on the
  // gym's Wi-Fi can't use up staff sign-in attempts (R-41).
  loginStaff: { name: "login-staff", limit: 10, windowSeconds: 15 * 60 },
  loginMember: { name: "login-member", limit: 10, windowSeconds: 15 * 60 },
  // Failed sign-ins for one account from one address. Locks that address
  // out of that account only (R-40).
  loginAccount: { name: "login-account", limit: 5, windowSeconds: 15 * 60 },
  // Failed sign-ins for one account from anywhere: a much higher cap that
  // still stops guessing spread across many addresses.
  loginAccountAnywhere: { name: "login-account-any", limit: 50, windowSeconds: 15 * 60 },
  signup: { name: "signup", limit: 5, windowSeconds: 60 * 60 },
  // Changing your own password needs the current one, so it's limited like
  // sign-in (R-45), in its own bucket so a required change at first sign-in
  // doesn't use up sign-in attempts (D-111).
  passwordChange: { name: "password-change", limit: 10, windowSeconds: 15 * 60 },
  // Forgotten-password requests per address, and per account (counted
  // silently, so the answer is the same whether or not the account exists).
  passwordResetRequest: { name: "reset-request", limit: 5, windowSeconds: 15 * 60 },
  passwordResetPerAccount: { name: "reset-account", limit: 3, windowSeconds: 60 * 60 },
  // Checking and using reset links.
  passwordReset: { name: "reset", limit: 10, windowSeconds: 15 * 60 },
  // Confirming email addresses, and asking for another link (per account).
  emailVerification: { name: "verify-email", limit: 20, windowSeconds: 15 * 60 },
  emailVerificationResend: { name: "verify-resend", limit: 3, windowSeconds: 60 * 60 },
  // Unsubscribe links: checking one and using it (D-118).
  unsubscribe: { name: "unsubscribe", limit: 30, windowSeconds: 15 * 60 },
  checkIn: { name: "check-in", limit: 120, windowSeconds: 60 },
  iot: { name: "iot", limit: 600, windowSeconds: 60 },
  bootstrap: { name: "bootstrap", limit: 5, windowSeconds: 60 * 60 },
  checkout: { name: "checkout", limit: 20, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;
