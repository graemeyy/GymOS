import { memberRoute, json } from "@/lib/http/route";
import { markOnboarded } from "@/lib/members/service";

// Marks the welcome steps as done (after choosing to pay online or at the
// front desk), so the member lands on their home screen from then on.
export const POST = memberRoute({}, async ({ db, member }) => {
  await markOnboarded(db, member.id);
  return json({ ok: true });
});
