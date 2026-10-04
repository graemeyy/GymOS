import { staffRoute, json } from "@/lib/http/route";
import { AttendanceBody, BookBody, MemberRef } from "@/lib/classes/schema";
import { bookMember, cancelBooking, markAttendance } from "@/lib/classes/service";

export const POST = staffRoute({ permission: "bookings.manage", body: BookBody }, async ({ params, body, db, staff }) => {
  return json(await bookMember(db, staff, params.id, body.memberId, { casual: body.casual }), 201);
});

export const PATCH = staffRoute({ permission: null, body: AttendanceBody }, async ({ params, body, db, staff }) => {
  return json(await markAttendance(db, staff, params.id, body));
});

export const DELETE = staffRoute({ permission: "bookings.manage", query: MemberRef }, async ({ params, query, db, staff }) => {
  return json(await cancelBooking(db, staff, params.id, query.memberId));
});
