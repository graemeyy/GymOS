import { prisma, type Db } from "@/lib/db";
import { gym } from "@/lib/config";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { slugify } from "@/lib/shop/products";
import { can } from "@/lib/auth/permissions";
import type { MembershipPlan } from "@prisma/client";
import type { CreatePlanInput, UpdatePlanInput } from "./schema";

const ONLY_ADMINS_PRICES = "Only admins can change prices.";

// What the audit log keeps as a plan's old and new values.
const planSnapshot = (p: MembershipPlan) => ({
  name: p.name,
  description: p.description,
  priceCents: p.priceCents,
  interval: p.interval,
  active: p.active,
  classCreditsPerCycle: p.classCreditsPerCycle,
  guestPassesPerCycle: p.guestPassesPerCycle,
  shopDiscountPercent: p.shopDiscountPercent,
  guestRateCents: p.guestRateCents,
});

// Creates plans from config that don't exist yet, with their benefits. Never
// overwrites a plan the owner has edited in the app, and never deletes one.
export async function syncPlansFromConfig(db: Db = prisma): Promise<{ created: string[] }> {
  const created: string[] = [];
  for (const [index, plan] of gym.plans.entries()) {
    const existing = await db.membershipPlan.findUnique({ where: { slug: plan.slug } });
    if (existing) continue;
    await db.membershipPlan.create({
      data: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        interval: plan.interval,
        sortOrder: 100 + index,
        ...plan.benefits,
      },
    });
    created.push(plan.slug);
  }
  return { created };
}

// A new plan sets a price, so it needs prices.edit as well as plans.edit.
export async function createPlan(db: Db, staff: StaffActor, input: CreatePlanInput) {
  if (!can(staff, "prices.edit")) throw new ApiError("forbidden", ONLY_ADMINS_PRICES, { priceCents: ONLY_ADMINS_PRICES });
  const slug = slugify(input.name);
  if (!slug) throw new ApiError("validation_failed", "Use a name with letters or numbers.", { name: "Invalid" });
  return db.$transaction(async (tx) => {
    if (await tx.membershipPlan.findUnique({ where: { slug } })) throw new ApiError("conflict", "A plan with that name already exists.", { name: "Already used" });
    const max = await tx.membershipPlan.aggregate({ _max: { sortOrder: true } });
    const plan = await tx.membershipPlan.create({ data: { ...input, description: input.description ?? null, slug, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    await logAction(tx, staff, { action: "plan.created", targetType: "MembershipPlan", targetId: plan.id, details: { name: plan.name }, after: planSnapshot(plan) });
    return plan;
  });
}

// Price changes apply to new sign-ups and plan changes. Existing Stripe
// subscriptions keep their price until changed, and members must be given
// notice of a price rise (see docs/COMPLIANCE-NOTES.md). Plans are retired
// (active: false), never deleted, so history and reports stay intact.
// Changing the price, billing interval or guest rate needs prices.edit as
// well as plans.edit.
export function updatePlan(db: Db, staff: StaffActor, id: string, input: UpdatePlanInput) {
  return db.$transaction(async (tx) => {
    const before = await tx.membershipPlan.findUniqueOrThrow({ where: { id } });
    const priceChanged = input.priceCents !== undefined && input.priceCents !== before.priceCents;
    const intervalChanged = input.interval !== undefined && input.interval !== before.interval;
    const guestRateChanged = input.guestRateCents !== undefined && input.guestRateCents !== before.guestRateCents;
    // The billing interval and the guest rate are part of what a plan costs.
    if (!can(staff, "prices.edit")) {
      if (priceChanged) throw new ApiError("forbidden", ONLY_ADMINS_PRICES, { priceCents: ONLY_ADMINS_PRICES });
      if (intervalChanged) throw new ApiError("forbidden", ONLY_ADMINS_PRICES, { interval: ONLY_ADMINS_PRICES });
      if (guestRateChanged) throw new ApiError("forbidden", ONLY_ADMINS_PRICES, { guestRateCents: ONLY_ADMINS_PRICES });
    }
    // Members' Stripe subscriptions keep the old interval, and credits and
    // billing dates would be worked out on the new one (R-38).
    if (intervalChanged && (await tx.member.count({ where: { OR: [{ planId: id }, { pendingPlanId: id }], archivedAt: null } })) > 0) {
      throw new ApiError("conflict", "Members are on this plan, so its billing interval can't change. Create a new plan and move members to it.");
    }
    const plan = await tx.membershipPlan.update({
      where: { id },
      data: { ...input, ...(priceChanged || intervalChanged ? { stripePriceId: null } : {}) },
    });
    await logAction(tx, staff, { action: priceChanged || intervalChanged || guestRateChanged ? "plan.price_changed" : "plan.updated", targetType: "MembershipPlan", targetId: plan.id, details: { name: plan.name }, before: planSnapshot(before), after: planSnapshot(plan) });
    return plan;
  });
}
