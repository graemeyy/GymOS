import { memberRoute, json } from "@/lib/http/route";
import { listPaymentsForMember } from "@/lib/billing/queries";

export const GET = memberRoute({}, async ({ db, member }) => json(await listPaymentsForMember(db, member.id)));
