import { staffRoute, json } from "@/lib/http/route";
import { ShiftBody, ShiftListQuery } from "@/lib/shifts/schema";
import { locationWhere } from "@/lib/locations/scope";
import { listUpcomingShifts } from "@/lib/shifts/queries";
import { createShift } from "@/lib/shifts/service";

export const GET = staffRoute({ permission: null, query: ShiftListQuery }, async ({ db, staff, query }) => json(await listUpcomingShifts(db, locationWhere(staff, query.locationId))));

export const POST = staffRoute({ permission: "classes.manage", body: ShiftBody }, async ({ body, db, staff }) => json(await createShift(db, staff, body), 201));
