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

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export const RATE_LIMITS = {
  login: { name: "login", limit: 10, windowSeconds: 15 * 60 },
  loginAccount: { name: "login-account", limit: 5, windowSeconds: 15 * 60 },
  signup: { name: "signup", limit: 5, windowSeconds: 60 * 60 },
  checkIn: { name: "check-in", limit: 120, windowSeconds: 60 },
  iot: { name: "iot", limit: 600, windowSeconds: 60 },
  bootstrap: { name: "bootstrap", limit: 5, windowSeconds: 60 * 60 },
  checkout: { name: "checkout", limit: 20, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;
