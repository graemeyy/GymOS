import { z } from "zod";
import { memberRoute, json, zPassword } from "@/lib/http/route";
import { setSessionCookie } from "@/lib/auth/session";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { changeMemberPassword } from "@/lib/members/account";

const Body = z.object({ current: z.string().min(1).max(200), next: zPassword });

// Changing the password signs out every other device.
export const POST = memberRoute({ body: Body, rateLimit: RATE_LIMITS.login }, async ({ body, db, member }) => {
  const ver = await changeMemberPassword(db, member.id, body.current, body.next);
  const response = json({ ok: true });
  await setSessionCookie(response, { kind: "member", sub: member.id, name: member.name, ver });
  return response;
});
