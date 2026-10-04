import { memberRoute, json } from "@/lib/http/route";
import { createPassToken } from "@/lib/checkin/qr";

// The member's QR pass. The front desk scanner checks status at scan time,
// so a pass for a paused or overdue membership shows, but won't let them in.
export const GET = memberRoute({}, async ({ db, member }) => {
  const me = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { qrVersion: true, status: true, name: true } });
  return json({ token: await createPassToken(member.id, me.qrVersion), status: me.status, name: me.name });
});
