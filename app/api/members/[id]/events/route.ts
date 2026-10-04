import { staffRoute, json } from "@/lib/http/route";
import { listMembershipEvents } from "@/lib/membership/queries";

export const GET = staffRoute({ permission: "members.view" }, async ({ params, db }) => json(await listMembershipEvents(db, params.id)));
