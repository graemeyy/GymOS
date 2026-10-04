import { staffRoute, json } from "@/lib/http/route";
import { listStaff } from "@/lib/staff/queries";

export const GET = staffRoute({ permission: "staff.manage" }, async ({ db }) => json(await listStaff(db)));
