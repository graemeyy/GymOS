import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";

export const DELETE = staffRoute({ permission: "shifts:manage" }, async ({ params, db, staff }) => {
  const shift = await db.shift.findUnique({ where: { id: params.id }, include: { staff: { select: { name: true } } } });
  if (!shift) throw new ApiError("not_found", "Shift not found.");
  await db.shift.delete({ where: { id: params.id } });
  await logAction(db, staff, { action: "shift.deleted", targetType: "Shift", targetId: params.id, details: { staffName: shift.staff.name, startTime: shift.startTime.toISOString() } });
  return json({ ok: true });
});
