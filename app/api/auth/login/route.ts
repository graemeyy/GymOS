import { z } from "zod";
import { publicRoute, json, zEmail } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { assertSignInAllowed, clientIp, RATE_LIMITS, recordFailedSignIn } from "@/lib/rate-limit";
import { logAction } from "@/lib/audit";

const Body = z.object({ email: zEmail, password: z.string().min(1).max(200) });

// Staff sign-in.
export const POST = publicRoute({ body: Body, rateLimit: RATE_LIMITS.loginStaff }, async ({ request, body, db }) => {
  const accountKey = `staff:${body.email}`;
  const accountFromHere = `${accountKey}:${clientIp(request)}`;
  await assertSignInAllowed(RATE_LIMITS.loginAccount, accountFromHere, db);
  await assertSignInAllowed(RATE_LIMITS.loginAccountAnywhere, accountKey, db);
  const staff = await db.staff.findUnique({ where: { email: body.email } });
  const ok = await verifyPasswordOrDummy(body.password, staff?.passwordHash);
  if (!staff || !ok) {
    await recordFailedSignIn(RATE_LIMITS.loginAccount, accountFromHere, db);
    await recordFailedSignIn(RATE_LIMITS.loginAccountAnywhere, accountKey, db);
    throw new ApiError("unauthenticated", "That email and password don't match a staff account.");
  }

  const response = json({ kind: "staff", name: staff.name, role: staff.role });
  await setSessionCookie(response, { kind: "staff", sub: staff.id, name: staff.name, role: staff.role, ver: staff.sessionVersion });
  await logAction(db, { kind: "staff", id: staff.id, name: staff.name, role: staff.role }, {
    action: "staff.signed_in",
    targetType: "Staff",
    targetId: staff.id,
  });
  return response;
});
