import { staffRoute, json } from "@/lib/http/route";
import { InviteStaffBody } from "@/lib/staff/schema";
import { inviteStaff } from "@/lib/staff/service";

export const POST = staffRoute({ permission: "staff.manage", body: InviteStaffBody }, async ({ body, db, staff }) => json(await inviteStaff(db, staff, body), 201));
