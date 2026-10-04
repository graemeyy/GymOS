// Signed tokens using Web Crypto only, so this file runs in middleware (edge)
// as well as in Node route handlers. Never import Prisma here.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE = "gymos_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type SessionPayload =
  | { kind: "staff"; sub: string; name: string; ver: number; exp: number }
  | { kind: "member"; sub: string; name: string; ver: number; exp: number };

export type SessionInput =
  | { kind: "staff"; sub: string; name: string; ver: number }
  | { kind: "member"; sub: string; name: string; ver: number };

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  }
  return value;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

// `purpose` is mixed into the signed bytes so a token signed for one use (a
// session) can never be replayed as another (a QR pass).
export async function signPayload(purpose: string, payload: object): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${purpose}.${body}`));
  return `${body}.${base64url(new Uint8Array(sig))}`;
}

export async function verifyPayload<T>(purpose: string, token: string | null | undefined): Promise<T | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, sig] = parts;
  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sig) as BufferSource,
      encoder.encode(`${purpose}.${body}`)
    );
    if (!valid) return null;
    return JSON.parse(decoder.decode(base64urlDecode(body))) as T;
  } catch {
    return null;
  }
}

export async function createSessionToken(input: SessionInput, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  return signPayload("session", { ...input, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
}

export async function verifySessionToken(token: string | null | undefined): Promise<SessionPayload | null> {
  const payload = await verifyPayload<Record<string, unknown>>("session", token);
  if (!payload) return null;
  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  if (typeof payload.ver !== "number") return null;
  const name = typeof payload.name === "string" ? payload.name : "";
  // Access comes from the database on every request, so the token carries no
  // role (older tokens that still have one are fine; it's ignored).
  if (payload.kind === "staff") {
    return { kind: "staff", sub: payload.sub, name, ver: payload.ver, exp: payload.exp };
  }
  if (payload.kind === "member") {
    return { kind: "member", sub: payload.sub, name, ver: payload.ver, exp: payload.exp };
  }
  return null;
}

export function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(trimmed.slice(name.length + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

// Constant-time comparison for shared secrets (cron, IoT gateway).
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const len = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < len; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}
