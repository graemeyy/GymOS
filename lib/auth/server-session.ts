import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "./token";

// For server-rendered pages: the signed-in member's ID, checked against the
// database like the API does (revoked or archived sessions don't count).
export async function currentMemberId(): Promise<string | null> {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || session.kind !== "member") return null;
  const member = await prisma.member.findUnique({ where: { id: session.sub }, select: { sessionVersion: true, archivedAt: true } });
  if (!member || member.archivedAt || member.sessionVersion !== session.ver) return null;
  return session.sub;
}
