import { staffRoute, json } from "@/lib/http/route";
import { ShiftBody } from "@/lib/shifts/schema";
import { listUpcomingShifts } from "@/lib/shifts/queries";
import { createShift } from "@/lib/shifts/service";

export const GET = staffRoute({ permission: null }, async ({ db }) => json(await listUpcomingShifts(db)));

export const POST = staffRoute({ permission: "classes.manage", body: ShiftBody }, async ({ body, db, staff }) => json(await createShift(db, staff, body), 201));
