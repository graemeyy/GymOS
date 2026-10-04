import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { listPlans } from "@/lib/plans";
import { canSeeRevenue } from "@/lib/auth/session";
import { CreatePlanBody } from "@/lib/plans-schema";
import { slugify } from "@/lib/shop/products";

// All plans, including retired ones, with member counts. Counts are left out
// when revenue is hidden, because price times count is the revenue (R-43).
export const GET = staffRoute({ permission: "members:read" }, async ({ db, staff }) => {
  const plans = await listPlans(db, { includeInactive: true });
  if (!(await canSeeRevenue(staff, db))) return json(plans.map((p) => ({ ...p, memberCount: null })));
  const counts = await db.member.groupBy({ by: ["planId"], where: { archivedAt: null, status: { not: "CANCELED" } }, _count: { _all: true } });
  const byPlan = new Map(counts.map((c) => [c.planId, c._count._all]));
  return json(plans.map((p) => ({ ...p, memberCount: byPlan.get(p.id) ?? 0 })));
});

export const POST = staffRoute({ permission: "plans:manage", body: CreatePlanBody }, async ({ body, db, staff }) => {
  const slug = slugify(body.name);
  if (!slug) throw new ApiError("validation_failed", "Use a name with letters or numbers.", { name: "Invalid" });
  if (await db.membershipPlan.findUnique({ where: { slug } })) throw new ApiError("conflict", "A plan with that name already exists.", { name: "Already used" });
  const max = await db.membershipPlan.aggregate({ _max: { sortOrder: true } });
  const plan = await db.membershipPlan.create({ data: { ...body, description: body.description ?? null, slug, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  await logAction(db, staff, { action: "plan.created", targetType: "MembershipPlan", targetId: plan.id, details: { name: plan.name, priceCents: plan.priceCents, interval: plan.interval } });
  return json(plan, 201);
});
