import { staffRoute, json } from "@/lib/http/route";
import { CreateStaffBody } from "@/lib/staff/schema";
import { listStaff } from "@/lib/staff/queries";
import { createStaff } from "@/lib/staff/service";

export const GET = staffRoute({ permission: "staff:read" }, async ({ db }) => json(await listStaff(db)));

export const POST = staffRoute({ permission: "staff:manage", body: CreateStaffBody }, async ({ body, db, staff }) => json(await createStaff(db, staff, body), 201));
