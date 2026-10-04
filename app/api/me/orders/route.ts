import { memberRoute, json } from "@/lib/http/route";
import { listOrdersForMember } from "@/lib/shop/queries";

// The member's own orders. Abandoned checkouts are left out.
export const GET = memberRoute({}, async ({ db, member }) => json(await listOrdersForMember(db, member.id)));
