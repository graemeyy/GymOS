import { publicRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { setSessionCookie, signInStaff } from "@/lib/auth/session";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { StaffSignInBody } from "@/lib/staff/schema";
import { recordFailedStaffSignIn, recordStaffSignIn } from "@/lib/staff/service";

const FAILURE_REASON = { unauthenticated: "wrong_password", forbidden: "deactivated", rate_limited: "locked" } as const;

// Staff sign-in. Failures are audited against the account (R-84).
export const POST = publicRoute({ body: StaffSignInBody, rateLimit: RATE_LIMITS.loginStaff }, async ({ request, body, db }) => {
  let staff;
  try {
    staff = await signInStaff(db, body.email, body.password, clientIp(request));
  } catch (error) {
    if (error instanceof ApiError && error.code in FAILURE_REASON) await recordFailedStaffSignIn(db, body.email, FAILURE_REASON[error.code as keyof typeof FAILURE_REASON]);
    throw error;
  }
  const response = json({ kind: "staff", name: staff.name, mustChangePassword: staff.mustChangePassword });
  await setSessionCookie(response, { kind: "staff", sub: staff.id, name: staff.name, ver: staff.sessionVersion });
  await recordStaffSignIn(db, staff);
  return response;
});
