import { z } from "zod";
import { staffRoute, json, zId } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { bookMember, cancelBooking } from "@/lib/classes/service";

const BookBody = z.object({ memberId: zId, casual: z.boolean().default(false) });

export const POST = staffRoute({ permission: "classes:book", body: BookBody }, async ({ params, body, db, staff }) => {
  return json(await bookMember(db, staff, params.id, body.memberId, { casual: body.casual }), 201);
});

const AttendanceBody = z.object({ memberId: zId, status: z.enum(["BOOKED", "ATTENDED", "NO_SHOW"]) });

// Trainers can only mark attendance for their own classes.
export const PATCH = staffRoute({ permission: "classes:attendance", body: AttendanceBody }, async ({ params, body, db, staff }) => {
  if (staff.role === "TRAINER") {
    const cls = await db.class.findUnique({ where: { id: params.id }, select: { trainerId: true } });
    if (!cls) throw new ApiError("not_found", "Class not found.");
    if (cls.trainerId !== staff.id) throw new ApiError("forbidden", "You can only mark attendance for your own classes.");
  }
  const booking = await db.classBooking.update({
    where: { classId_memberId: { classId: params.id, memberId: body.memberId } },
    data: { status: body.status },
  });
  await logAction(db, staff, { action: "class.attendance_marked", targetType: "Class", targetId: params.id, details: body });
  return json(booking);
});

export const DELETE = staffRoute({ permission: "classes:book", query: z.object({ memberId: zId }) }, async ({ params, query, db, staff }) => {
  return json(await cancelBooking(db, staff, params.id, query.memberId));
});
