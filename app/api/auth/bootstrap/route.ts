import { publicRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { env } from "@/lib/env";
import { timingSafeEqualStrings } from "@/lib/auth/token";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { BootstrapBody } from "@/lib/staff/schema";
import { isSetupNeeded } from "@/lib/staff/queries";
import { createFirstOwner } from "@/lib/staff/service";

export const GET = publicRoute({}, async ({ db }) => json({ needsSetup: await isSetupNeeded(db), tokenRequired: Boolean(env().SETUP_TOKEN) }));

// Creates the very first staff account, as OWNER, and then refuses forever.
// With SETUP_TOKEN set, the token is required; a production deployment
// without one refuses, so whoever finds a new site first can't own it (R-42).
export const POST = publicRoute({ body: BootstrapBody, rateLimit: RATE_LIMITS.bootstrap }, async ({ body, db }) => {
  const { SETUP_TOKEN, NODE_ENV } = env();
  if (!SETUP_TOKEN && NODE_ENV === "production") {
    throw new ApiError("not_configured", "Set SETUP_TOKEN in the environment to create the first owner account.");
  }
  if (SETUP_TOKEN && !timingSafeEqualStrings(body.setupToken ?? "", SETUP_TOKEN)) {
    throw new ApiError("forbidden", "That setup token isn't right.", { setupToken: "Doesn't match" });
  }
  const staff = await createFirstOwner(db, body);
  return json({ id: staff.id }, 201);
});
