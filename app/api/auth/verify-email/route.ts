import { publicRoute, json } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { VerifyEmailBody } from "@/lib/auth/password-reset-schema";
import { verifyEmail } from "@/lib/members/verification";

// Confirms a member's email from the link we sent (D-113). A POST from a
// button on the page, not the link itself, so mail scanners that open links
// don't confirm anything.
export const POST = publicRoute({ body: VerifyEmailBody, rateLimit: RATE_LIMITS.emailVerification }, async ({ body, db }) => json(await verifyEmail(db, body.token)));
