import { z } from "zod";
import { staffRoute, json, zName, zCents } from "@/lib/http/route";
import { logAction } from "@/lib/audit";

const Body = z
  .object({ name: zName.optional(), description: z.string().trim().max(500).nullable().optional(), priceCents: zCents.optional(), active: z.boolean().optional() })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

// Price changes apply to new sign-ups. Existing subscriptions keep their Stripe
// price until changed, and members must be given notice of a price rise
// (see docs/COMPLIANCE-NOTES.md).
export const PUT = staffRoute({ permission: "plans:manage", body: Body }, async ({ params, body, db, staff }) => {
  const before = await db.membershipPlan.findUniqueOrThrow({ where: { id: params.id } });
  const plan = await db.membershipPlan.update({
    where: { id: params.id },
    // A new price needs a new Stripe price, so drop the cached one.
    data: { ...body, ...(body.priceCents !== undefined && body.priceCents !== before.priceCents ? { stripePriceId: null } : {}) },
  });
  await logAction(db, staff, { action: "plan.updated", targetType: "MembershipPlan", targetId: plan.id, details: { from: { name: before.name, priceCents: before.priceCents, active: before.active }, to: body } });
  return json(plan);
});
