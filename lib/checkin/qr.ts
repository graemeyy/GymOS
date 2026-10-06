import { signPayload, verifyPayload } from "@/lib/auth/token";
import { OLD_PASS_PREFIX as OLD_PREFIX, PASS_PREFIX as PREFIX } from "./pass-format";

export { looksLikePass } from "./pass-format";

// A member's check-in pass is short-lived (R-34, D-119): a signed token of
// member ID, pass version and the moment it was issued. The pass page fetches
// a fresh one every minute, and the front desk refuses a code more than 90
// seconds old, or one that has already let someone in, so a screenshot or a
// forwarded code stops working almost straight away. Reissuing a pass (lost
// phone) still bumps the version. The token is signed for its own purpose, so
// it can't be used as a session, and a session can't be used as a pass.
export const PASS_REFRESH_SECONDS = 60;
export const PASS_VALID_SECONDS = 90;
// A code from slightly in the future (another server's clock) is still fine.
const FUTURE_LEEWAY_SECONDS = 5;

const PURPOSE = "qr-pass";

interface PassPayload {
  m: string;
  v: number;
  t: number;
}

export type PassCheck =
  | { ok: true; memberId: string; version: number; issuedAt: Date }
  | { ok: false; reason: "invalid" | "old" }
  | { ok: false; reason: "expired"; memberId: string };

export async function createPassToken(memberId: string, version: number, now = new Date()): Promise<{ token: string; issuedAt: Date; expiresAt: Date }> {
  const t = Math.floor(now.getTime() / 1000);
  const token = `${PREFIX}${await signPayload(PURPOSE, { m: memberId, v: version, t } satisfies PassPayload)}`;
  return { token, issuedAt: new Date(t * 1000), expiresAt: new Date((t + PASS_VALID_SECONDS) * 1000) };
}

export async function readPassToken(token: string, now = new Date()): Promise<PassCheck> {
  if (token.startsWith(OLD_PREFIX)) return { ok: false, reason: "old" };
  if (!token.startsWith(PREFIX)) return { ok: false, reason: "invalid" };
  const payload = await verifyPayload<Record<string, unknown>>(PURPOSE, token.slice(PREFIX.length));
  if (!payload || typeof payload.m !== "string" || !payload.m || !Number.isInteger(payload.v) || !Number.isInteger(payload.t)) return { ok: false, reason: "invalid" };
  const { m, v, t } = payload as unknown as PassPayload;
  const age = now.getTime() / 1000 - t;
  if (age < -FUTURE_LEEWAY_SECONDS) return { ok: false, reason: "invalid" };
  if (age > PASS_VALID_SECONDS) return { ok: false, reason: "expired", memberId: m };
  return { ok: true, memberId: m, version: v, issuedAt: new Date(t * 1000) };
}
