import { staffRoute, json } from "@/lib/http/route";
import { UpdateStaffBody } from "@/lib/staff/schema";
import { updateStaff } from "@/lib/staff/service";

// Name, role and active status. Accounts are deactivated rather than deleted,
// so their history in the audit log stays attached to them.
export const PUT = staffRoute({ permission: "staff.manage", body: UpdateStaffBody }, async ({ params, body, db, staff }) => json(await updateStaff(db, staff, params.id, body)));
