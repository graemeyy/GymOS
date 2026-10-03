import { publicRoute, json } from "@/lib/http/route";
import { clearSessionCookie, readSession } from "@/lib/auth/session";

// Signing out bumps the account's session version, which also ends that
// account's sessions on other devices. Stateless tokens can't be revoked
// one at a time; see docs/DECISIONS.md.
export const POST = publicRoute({}, async ({ request, db }) => {
  const session = await readSession(request);
  if (session?.kind === "staff") {
    await db.staff.updateMany({ where: { id: session.sub, sessionVersion: session.ver }, data: { sessionVersion: { increment: 1 } } });
  } else if (session?.kind === "member") {
    await db.member.updateMany({ where: { id: session.sub, sessionVersion: session.ver }, data: { sessionVersion: { increment: 1 } } });
  }
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
});
