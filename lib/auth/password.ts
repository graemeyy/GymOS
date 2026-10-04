import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "crypto";

// scrypt with its cost stored in each hash, so the cost can be raised later
// without breaking existing passwords (R-77). Format:
//   scrypt$<N>$<r>$<p>$<salt-hex>$<hash-hex>
// Hashes from before this format ("<salt-hex>:<hash-hex>") used Node's
// defaults, which are the values below, and still verify.
const COST = { N: 16_384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
// Room for higher costs read from stored hashes (128 * N * r bytes).
const MAX_MEMORY = 256 * 1024 * 1024;

function derive(password: string, salt: string, cost: { N: number; r: number; p: number }): Promise<Buffer> {
  const options: ScryptOptions = { ...cost, maxmem: MAX_MEMORY };
  return new Promise((resolve, reject) => scrypt(password, salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await derive(password, salt, COST);
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt}$${derived.toString("hex")}`;
}

function parseStored(stored: string): { salt: string; hash: Buffer; cost: { N: number; r: number; p: number } } | null {
  if (stored.startsWith("scrypt$")) {
    const [, n, r, p, salt, hashHex] = stored.split("$");
    const cost = { N: Number(n), r: Number(r), p: Number(p) };
    if (!salt || !hashHex || !Object.values(cost).every((v) => Number.isInteger(v) && v > 0)) return null;
    return { salt, hash: Buffer.from(hashHex, "hex"), cost };
  }
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return null;
  return { salt, hash: Buffer.from(hashHex, "hex"), cost: COST };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStored(stored);
  if (!parsed) return false;
  const derived = await derive(password, parsed.salt, parsed.cost);
  if (derived.length !== parsed.hash.length) return false;
  return timingSafeEqual(derived, parsed.hash);
}

// A fixed, valid hash to compare against when the email doesn't exist, so a
// login for an unknown account takes as long as one with a wrong password.
const DUMMY_HASH = `scrypt$${COST.N}$${COST.r}$${COST.p}$${"0".repeat(32)}$${"0".repeat(KEY_LENGTH * 2)}`;

export async function verifyPasswordOrDummy(password: string, stored: string | null | undefined): Promise<boolean> {
  const ok = await verifyPassword(password, stored ?? DUMMY_HASH);
  return Boolean(stored) && ok;
}
