import { z } from "zod";
import { memberRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie } from "@/lib/auth/session";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { deletionBlockers, eraseMember } from "@/lib/members/account";

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
  const record = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { passwordHash: true } });
  if (!record.passwordHash || !(await verifyPassword(body.password, record.passwordHash))) {
    throw new ApiError("validation_failed", "That password isn't right.", { password: "Doesn't match" });
  }
  await eraseMember(db, member, member.id);
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
});
