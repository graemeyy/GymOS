import { publicRoute, json } from "@/lib/http/route";
import { resolveMember } from "@/lib/auth/session";
import { getCatalogue } from "@/lib/shop/queries";

// The public catalogue, with the signed-in member's discount if any.
export const GET = publicRoute({}, async ({ request, db }) => {
  const member = await resolveMember(request, db);
  return json(await getCatalogue(member?.id ?? null, {}, db));
});
