import { signPayload, verifyPayload } from "@/lib/auth/token";

// A member's check-in pass is a signed token: member ID plus a version
// number. Reissuing a pass (lost phone) bumps the version, so old passes stop
// working. The token is signed for the "qr" purpose only, so it can't be used
// as a session, and a session can't be used as a pass.
interface PassPayload {
  m: string;
  v: number;
}

export async function createPassToken(memberId: string, qrVersion: number): Promise<string> {
  return `GYM1.${await signPayload("qr", { m: memberId, v: qrVersion } satisfies PassPayload)}`;
}

export async function readPassToken(token: string): Promise<PassPayload | null> {
  if (!token.startsWith("GYM1.")) return null;
  const payload = await verifyPayload<PassPayload>("qr", token.slice(5));
  if (!payload || typeof payload.m !== "string" || typeof payload.v !== "number") return null;
  return payload;
}
