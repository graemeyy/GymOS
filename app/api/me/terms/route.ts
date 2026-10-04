import { memberRoute, json } from "@/lib/http/route";
import { outstandingAcceptances, recordAcceptance } from "@/lib/legal";
import { logAction } from "@/lib/audit";
import { gym } from "@/lib/config";

// Accepts the current terms and privacy policy (after the gym publishes a new
// version, or for members added by staff before online sign-up).
export const POST = memberRoute({}, async ({ db, member }) => {
  const outstanding = await outstandingAcceptances(db, member.id);
  if (outstanding.length > 0) {
    await recordAcceptance(db, member.id, "reaccept", outstanding);
    await logAction(db, member, { action: "member.terms_accepted", targetType: "Member", targetId: member.id, details: { documents: outstanding, termsVersion: gym.legal.termsVersion, privacyVersion: gym.legal.privacyVersion } });
  }
  return json({ outstandingAcceptances: [] });
});
