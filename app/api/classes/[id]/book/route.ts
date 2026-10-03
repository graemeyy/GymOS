import { z } from "zod";
import { staffRoute, json, zId } from "@/lib/http/route";
import { logAction } from "@/lib/audit";
import { bookMember, cancelBooking } from "@/lib/classes/service";

const MemberBody = z.object({ memberId: zId });

export const POST = staffRoute({ permission: "classes:book", body: MemberBody }, async ({ params, body, db, staff }) => {
  return json(await bookMember(db, staff, params.id, body.memberId), 201);
});

const AttendanceBody = z.object({ memberId: zId, status: z.enum(["BOOKED", "ATTENDED", "NO_SHOW"]) });

export const PATCH = staffRoute({ permission: "classes:attendance", body: AttendanceBody }, async ({ params, body, db, staff }) => {
  const booking = await db.classBooking.update({
    where: { classId_memberId: { classId: params.id, memberId: body.memberId } },
    data: { status: body.status },
  });
  await logAction(db, staff, { action: "class.attendance_marked", targetType: "Class", targetId: params.id, details: body });
  return json(booking);
});

export const DELETE = staffRoute({ permission: "classes:book", query: MemberBody }, async ({ params, query, db, staff }) => {
  await cancelBooking(db, staff, params.id, query.memberId);
  return json({ ok: true });
});
