import { z } from "zod";
import { publicRoute, json, zEmail, zName, zPassword } from "@/lib/http/route";
import { setSessionCookie } from "@/lib/auth/session";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { signUpMember } from "@/lib/members/account";

const Body = z.object({
  name: zName,
  email: zEmail,
  password: zPassword,
  acceptTerms: z.literal(true, { error: "Please accept the membership terms and privacy policy" }),
});

// Creates a member account with no plan (status PENDING) and signs them in.
// They choose a plan and pay next; until then they have no access.
export const POST = publicRoute({ body: Body, rateLimit: RATE_LIMITS.signup }, async ({ body, db }) => {
  const member = await signUpMember(db, body);
  const name = member.name ?? member.email;
  const response = json({ kind: "member", name }, 201);
  await setSessionCookie(response, { kind: "member", sub: member.id, name, ver: member.sessionVersion });
  return response;
});
