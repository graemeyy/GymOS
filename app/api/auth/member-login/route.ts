import { z } from "zod";
import { publicRoute, json, zEmail } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const Body = z.object({ email: zEmail, password: z.string().min(1).max(200) });

// Member sign-in. Archived members can't sign in.
export const POST = publicRoute({ body: Body, rateLimit: RATE_LIMITS.login }, async ({ body, db }) => {
  await enforceRateLimit(RATE_LIMITS.loginAccount, `member:${body.email}`, db);
  const member = await db.member.findUnique({ where: { email: body.email } });
  const ok = await verifyPasswordOrDummy(body.password, member?.archivedAt ? null : member?.passwordHash);
  if (!member || !ok) throw new ApiError("unauthenticated", "That email and password don't match a member account.");

  const name = member.name ?? member.email;
  const response = json({ kind: "member", name });
  await setSessionCookie(response, { kind: "member", sub: member.id, name, ver: member.sessionVersion });
  return response;
});
