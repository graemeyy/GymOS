import { staffRoute, json } from "@/lib/http/route";
import { listStaffDirectory } from "@/lib/staff/queries";

// Names of active staff for trainer and roster pickers.
export const GET = staffRoute({ permission: null }, async ({ db }) => json(await listStaffDirectory(db)));
