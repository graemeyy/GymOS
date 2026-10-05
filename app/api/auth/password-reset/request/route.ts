import { publicRoute, json } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ResetRequestBody } from "@/lib/auth/password-reset-schema";
import { requestPasswordReset } from "@/lib/auth/password-reset";

// "Forgot your password?" (D-112). Always the same answer, whether or not
// the email has an account. previewLink appears only outside production when
// email isn't set up (D-115).
export const POST = publicRoute({ body: ResetRequestBody, rateLimit: RATE_LIMITS.passwordResetRequest }, async ({ body, db }) => {
  const { previewLink } = await requestPasswordReset(db, body.kind, body.email);
  return json({ ok: true, ...(previewLink ? { previewLink } : {}) });
});
