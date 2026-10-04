import { staffRoute, json } from "@/lib/http/route";
import { cancelClass } from "@/lib/classes/service";

// Cancels a class: bookings are released with credits returned, and the class
// stays as a cancelled row so the timetable job doesn't recreate it.
export const DELETE = staffRoute({ permission: "classes:manage" }, async ({ params, db, staff }) => {
  return json({ ok: true, ...(await cancelClass(db, staff, params.id)) });
});
