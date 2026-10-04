import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";

export const DELETE = staffRoute({ permission: "classes:manage" }, async ({ params, db, staff }) => {
  const cls = await db.class.findUnique({ where: { id: params.id }, include: { _count: { select: { bookings: true } } } });
  if (!cls) throw new ApiError("not_found", "Class not found.");
  await db.class.delete({ where: { id: params.id } });
  await logAction(db, staff, {
    action: "class.cancelled",
    targetType: "Class",
    targetId: params.id,
    details: { name: cls.name, startTime: cls.startTime.toISOString(), bookingsRemoved: cls._count.bookings },
  });
  return json({ ok: true });
});
