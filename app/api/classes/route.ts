import { staffRoute, json } from "@/lib/http/route";
import { ClassBody, ClassListQuery } from "@/lib/classes/schema";
import { listClasses } from "@/lib/classes/queries";
import { createClass } from "@/lib/classes/service";
import { ownClassesOnly } from "@/lib/auth/access";
import { forViewer } from "@/lib/members/privacy";
import { locationWhere } from "@/lib/locations/scope";

// Everyone sees the schedule. A trainer without booking or member
// permissions sees only their own classes, with booked members' names (R-33).
export const GET = staffRoute({ permission: null, query: ClassListQuery }, async ({ query, db, staff }) => {
  const mine = query.mine === "1" || ownClassesOnly(staff);
  // One location, or every location the person's role covers (D-128).
  const classes = await listClasses(db, { from: query.from, to: query.to, trainerId: mine ? staff.id : undefined, where: locationWhere(staff, query.locationId) });
  return json(
    classes.map((c) => ({
      ...c,
      bookings: c.bookings.map((b) => forViewer(staff, b)),
      waitlist: c.waitlist.map((w) => forViewer(staff, w)),
    }))
  );
});

export const POST = staffRoute({ permission: "classes.manage", body: ClassBody }, async ({ body, db, staff }) => {
  return json(await createClass(db, staff, body), 201);
});
