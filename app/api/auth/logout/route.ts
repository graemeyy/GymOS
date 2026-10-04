import { publicRoute, json } from "@/lib/http/route";
import { clearSessionCookie, endAllSessions, readSession } from "@/lib/auth/session";

// Signing out also ends the account's sessions on other devices.
export const POST = publicRoute({}, async ({ request, db }) => {
  const session = await readSession(request);
  if (session) await endAllSessions(db, session);
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
});
