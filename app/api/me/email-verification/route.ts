import { memberRoute, json } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { resendEmailVerification } from "@/lib/members/verification";

// Sends the confirmation link again (at most three an hour).
export const POST = memberRoute({ rateLimit: RATE_LIMITS.emailVerification }, async ({ db, member }) => {
  const { previewLink } = await resendEmailVerification(db, member);
  return json({ ok: true, ...(previewLink ? { previewLink } : {}) });
});
