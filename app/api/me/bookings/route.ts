import { memberRoute, json } from "@/lib/http/route";
import { getUpcomingBookingsForMember } from "@/lib/classes/queries";

export const GET = memberRoute({}, async ({ db, member }) => json(await getUpcomingBookingsForMember(db, member.id)));
