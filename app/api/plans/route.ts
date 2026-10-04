import { publicRoute, json } from "@/lib/http/route";
import { listPlans, benefitsForSlug } from "@/lib/plans";

// Public: the join page lists plans. Only active plans, no internal fields.
export const GET = publicRoute({}, async ({ db }) => {
  const plans = await listPlans(db);
  return json(plans.map((p) => ({ ...p, benefits: benefitsForSlug(p.slug) })));
});
