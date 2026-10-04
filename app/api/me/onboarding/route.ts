import { memberRoute, json } from "@/lib/http/route";

// Marks the welcome steps as done (after choosing to pay online or at the
// front desk), so the member lands on their home screen from then on.
export const POST = memberRoute({}, async ({ db, member }) => {
  await db.member.updateMany({ where: { id: member.id, onboardedAt: null }, data: { onboardedAt: new Date() } });
  return json({ ok: true });
});
