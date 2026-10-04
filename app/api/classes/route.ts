import { staffRoute, json } from "@/lib/http/route";
import { ClassBody, ClassListQuery } from "@/lib/classes/schema";
import { listClasses } from "@/lib/classes/queries";
import { createClass } from "@/lib/classes/service";
import { ownClassesOnly } from "@/lib/auth/access";
import { forViewer } from "@/lib/members/privacy";

// Everyone sees the schedule. A trainer without booking or member
// permissions sees only their own classes, with booked members' names (R-33).
export const GET = staffRoute({ permission: null, query: ClassListQuery }, async ({ query, db, staff }) => {
  const mine = query.mine === "1" || ownClassesOnly(staff);
  const classes = await listClasses(db, { from: query.from, to: query.to, trainerId: mine ? staff.id : undefined });
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
