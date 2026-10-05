import { createHash, randomBytes } from "crypto";
import type { AuthTokenPurpose } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";

// Single-use links sent by email (D-112, D-113). The token is 32 random
// bytes; only its SHA-256 hash is stored, so a database copy can't be used
// to reset anyone's password.
export const hashAuthToken = (token: string) => createHash("sha256").update(token).digest("hex");

type Owner = { staffId: string } | { memberId: string };

// A new link for this purpose replaces any earlier unused one for the same
// account, so only the latest email works.
export async function issueAuthToken(tx: Tx, opts: { purpose: AuthTokenPurpose; owner: Owner; email: string; ttlMs: number }): Promise<string> {
  const now = new Date();
  await tx.authToken.updateMany({ where: { ...opts.owner, purpose: opts.purpose, usedAt: null }, data: { usedAt: now } });
  const token = randomBytes(32).toString("base64url");
  await tx.authToken.create({
    data: { tokenHash: hashAuthToken(token), purpose: opts.purpose, ...opts.owner, email: opts.email, expiresAt: new Date(now.getTime() + opts.ttlMs) },
  });
  return token;
}

/** The token's record if it's unused and unexpired, without using it up. */
export async function findUsableAuthToken(db: Db | Tx, token: string, purpose: AuthTokenPurpose) {
  const row = await db.authToken.findUnique({ where: { tokenHash: hashAuthToken(token) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= new Date()) return null;
  return row;
}

// Uses the token up in one conditional update, so two requests with the
// same link can't both succeed.
export async function consumeAuthToken(tx: Tx, token: string, purpose: AuthTokenPurpose) {
  const tokenHash = hashAuthToken(token);
  const now = new Date();
  const claimed = await tx.authToken.updateMany({ where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
  if (claimed.count !== 1) return null;
  return tx.authToken.findUniqueOrThrow({ where: { tokenHash } });
}

// Tokens arrive in links; anything that isn't the right shape can't match.
export const isTokenShaped = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{20,200}$/.test(value);
