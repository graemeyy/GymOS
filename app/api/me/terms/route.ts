import { memberRoute, json } from "@/lib/http/route";
import { acceptCurrentTerms } from "@/lib/legal";

// Accepts the current terms and privacy policy (after the gym publishes a new
// version, or for members added by staff before online sign-up).
export const POST = memberRoute({}, async ({ db, member }) => {
  await acceptCurrentTerms(db, member);
  return json({ outstandingAcceptances: [] });
});
