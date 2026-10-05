import { z } from "zod";
import { publicRoute, json, zEmail } from "@/lib/http/route";
import { setSessionCookie, signInMember } from "@/lib/auth/session";
import { clientIp, RATE_LIMITS } from "@/lib/rate-limit";

const Body = z.object({ email: zEmail, password: z.string().min(1).max(200) });

// Member sign-in. Archived members can't sign in.
export const POST = publicRoute({ body: Body, rateLimit: RATE_LIMITS.loginMember }, async ({ request, body, db }) => {
  const member = await signInMember(db, body.email, body.password, clientIp(request));
  const name = member.name ?? member.email;
  const response = json({ kind: "member", name, mustChangePassword: member.mustChangePassword });
  await setSessionCookie(response, { kind: "member", sub: member.id, name, ver: member.sessionVersion });
  return response;
});
