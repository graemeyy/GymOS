import { z } from "zod";
import { memberRoute, json } from "@/lib/http/route";
import { clearSessionCookie } from "@/lib/auth/session";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { deleteOwnAccount, deletionBlockers } from "@/lib/members/account";

// Whether the account can be deleted right now, and if not, why.
export const GET = memberRoute({}, async ({ db, member }) => {
  return json({ blockers: await deletionBlockers(db, member.id) });
});

const Body = z.object({
  password: z.string().min(1).max(200),
  confirm: z.literal("DELETE", { error: 'Type DELETE to confirm' }),
});

// Erases the member's personal details. Financial records stay (tax law),
// without their name or email.
export const DELETE = memberRoute({ body: Body, rateLimit: RATE_LIMITS.loginMember }, async ({ body, db, member }) => {
  await deleteOwnAccount(db, member, body.password);
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
});
