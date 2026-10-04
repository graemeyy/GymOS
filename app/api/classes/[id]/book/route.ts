import { staffRoute, json } from "@/lib/http/route";
import { AttendanceBody, BookBody, MemberRef } from "@/lib/classes/schema";
import { bookMember, cancelBooking, markAttendance } from "@/lib/classes/service";

export const POST = staffRoute({ permission: "classes:book", body: BookBody }, async ({ params, body, db, staff }) => {
  return json(await bookMember(db, staff, params.id, body.memberId, { casual: body.casual }), 201);
});

export const PATCH = staffRoute({ permission: "classes:attendance", body: AttendanceBody }, async ({ params, body, db, staff }) => {
  return json(await markAttendance(db, staff, params.id, body));
});

export const DELETE = staffRoute({ permission: "classes:book", query: MemberRef }, async ({ params, query, db, staff }) => {
  return json(await cancelBooking(db, staff, params.id, query.memberId));
});
