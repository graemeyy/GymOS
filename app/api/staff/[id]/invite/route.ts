import { staffRoute, json } from "@/lib/http/route";
import { resendInvite } from "@/lib/staff/service";

export const POST = staffRoute({ permission: "staff.manage" }, async ({ params, db, staff }) => json(await resendInvite(db, staff, params.id)));
