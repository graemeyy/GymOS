import { z } from "zod";
import { publicRoute, json } from "@/lib/http/route";
import { resolveMember } from "@/lib/auth/session";
import { getCatalogue } from "@/lib/shop/queries";

const Query = z.object({ locationId: z.string().min(1).max(40).optional() });

// The public catalogue, with the signed-in member's discount if any, and
// availability at a location: the one asked for, or the member's home
// location (D-127).
export const GET = publicRoute({ query: Query }, async ({ request, db, query }) => {
  const member = await resolveMember(request, db);
  return json(await getCatalogue(member?.id ?? null, {}, db, query.locationId));
});
