import { publicRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { setSessionCookie } from "@/lib/auth/session";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { AcceptInviteBody } from "@/lib/staff/schema";
import { acceptInvite, getInvite } from "@/lib/staff/service";

// Accepting a staff invitation: the token in the link is the only credential,
// so both calls are rate limited per address.
export const GET = publicRoute({ rateLimit: RATE_LIMITS.loginStaff }, async ({ request, db }) => {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length < 20 || token.length > 200) throw new ApiError("not_found", "This invitation has expired or was already used. Ask for a new one.");
  return json(await getInvite(db, token));
});

export const POST = publicRoute({ body: AcceptInviteBody, rateLimit: RATE_LIMITS.loginStaff }, async ({ body, db }) => {
  const staff = await acceptInvite(db, body.token, body.password);
  const response = json({ kind: "staff", name: staff.name });
  await setSessionCookie(response, { kind: "staff", sub: staff.id, name: staff.name, ver: staff.sessionVersion });
  return response;
});
