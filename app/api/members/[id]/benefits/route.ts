import { staffRoute, json } from "@/lib/http/route";
import { BenefitAdjustmentBody } from "@/lib/membership/schema";
import { adjustBenefit, getBenefitUsage } from "@/lib/membership/benefits";
import { listBenefitHistory } from "@/lib/membership/queries";

export const GET = staffRoute({ permission: "members:read" }, async ({ params, db }) => {
  const [usage, history] = await Promise.all([getBenefitUsage(db, params.id), listBenefitHistory(db, params.id)]);
  return json({ ...usage, history });
});

// Manual adjustments: extra classes as a goodwill gesture, a guest pass, or
// account credit in cents. Manager or owner only, always with a reason.
export const POST = staffRoute({ permission: "billing:manage", body: BenefitAdjustmentBody }, async ({ params, body, db, staff }) => json(await adjustBenefit(db, staff, params.id, body), 201));
