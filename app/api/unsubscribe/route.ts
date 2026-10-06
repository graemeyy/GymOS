import { z } from "zod";
import { publicRoute, json, handleError } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { RATE_LIMITS, clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { describeUnsubscribe, unsubscribe } from "@/lib/members/unsubscribe";

const TokenQuery = z.object({ token: z.string().min(1).max(500) });

// What an unsubscribe link switches off, for the page to ask before it does.
export const GET = publicRoute({ query: TokenQuery, rateLimit: RATE_LIMITS.unsubscribe }, async ({ query, db }) => json(await describeUnsubscribe(db, query.token)));

// Switches the email off (D-118). Two callers: the button on /unsubscribe,
// and mail apps' own "Unsubscribe" button, which POSTs
// "List-Unsubscribe=One-Click" here from the mail provider's servers
// (RFC 8058). So this isn't wrapped in publicRoute: there's no Origin to
// check and the body isn't JSON. The signed token is the only authority, and
// all it can do is turn one kind of email off for one member.
export async function POST(request: Request) {
  try {
    await enforceRateLimit(RATE_LIMITS.unsubscribe, clientIp(request));
    const parsed = TokenQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) throw new ApiError("not_found", "This unsubscribe link isn't valid. You can switch emails off in your account instead.");
    const oneClick = request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") ?? false;
    return json(await unsubscribe(parsed.data.token, oneClick ? "one-click" : "page"));
  } catch (error) {
    return handleError(error);
  }
}
