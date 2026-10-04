import { publicRoute, json } from "@/lib/http/route";
import { setSessionCookie, signInStaff } from "@/lib/auth/session";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { StaffSignInBody } from "@/lib/staff/schema";
import { recordStaffSignIn } from "@/lib/staff/service";

// Staff sign-in.
export const POST = publicRoute({ body: StaffSignInBody, rateLimit: RATE_LIMITS.loginStaff }, async ({ request, body, db }) => {
  const staff = await signInStaff(db, body.email, body.password, clientIp(request));
  const response = json({ kind: "staff", name: staff.name, role: staff.role });
  await setSessionCookie(response, { kind: "staff", sub: staff.id, name: staff.name, role: staff.role, ver: staff.sessionVersion });
  await recordStaffSignIn(db, staff);
  return response;
});
