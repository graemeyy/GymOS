import { staffRoute, json } from "@/lib/http/route";
import { setSessionCookie } from "@/lib/auth/session";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ChangeOwnPasswordBody } from "@/lib/staff/schema";
import { changeOwnPassword } from "@/lib/staff/service";

// Any staff member can change their own password. Other sessions for the
// account end; this one gets a fresh cookie.
// Rate limited, so a stolen session can't be used to guess the current
// password (R-45).
export const POST = staffRoute({ permission: null, body: ChangeOwnPasswordBody, rateLimit: RATE_LIMITS.passwordChange, allowPendingPasswordChange: true }, async ({ body, db, staff }) => {
  const updated = await changeOwnPassword(db, staff, body.currentPassword, body.newPassword);
  const response = json({ ok: true });
  await setSessionCookie(response, { kind: "staff", sub: updated.id, name: updated.name, ver: updated.sessionVersion });
  return response;
});
