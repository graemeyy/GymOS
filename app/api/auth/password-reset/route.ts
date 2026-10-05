import { publicRoute, json } from "@/lib/http/route";
import { setSessionCookie } from "@/lib/auth/session";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { ResetBody, ResetTokenQuery } from "@/lib/auth/password-reset-schema";
import { checkResetLink, resetPassword } from "@/lib/auth/password-reset";

// Whether a reset link still works, before asking for a new password.
export const GET = publicRoute({ query: ResetTokenQuery, rateLimit: RATE_LIMITS.passwordReset }, async ({ query, db }) => json(await checkResetLink(db, query.token)));

// Sets the new password, ends every other session for the account, and
// signs this browser in.
export const POST = publicRoute({ body: ResetBody, rateLimit: RATE_LIMITS.passwordReset }, async ({ body, db }) => {
  const account = await resetPassword(db, body.token, body.password);
  const response = json({ kind: account.kind, name: account.name });
  await setSessionCookie(response, { kind: account.kind, sub: account.id, name: account.name, ver: account.sessionVersion });
  return response;
});
