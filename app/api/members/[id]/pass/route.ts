import { staffRoute, json } from "@/lib/http/route";
import { logAction } from "@/lib/audit";

// Reissues the member's QR pass (lost or shared phone). Old passes stop working.
export const POST = staffRoute({ permission: "members:write" }, async ({ params, db, staff }) => {
  const member = await db.member.update({ where: { id: params.id }, data: { qrVersion: { increment: 1 } }, select: { id: true, qrVersion: true } });
  await logAction(db, staff, { action: "member.pass_reissued", targetType: "Member", targetId: params.id, details: { version: member.qrVersion } });
  return json({ ok: true });
});
