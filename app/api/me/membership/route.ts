import { memberRoute, json } from "@/lib/http/route";
import { gym } from "@/lib/config";
import { listPlans } from "@/lib/plans/queries";
import { cancellationTerms, previewPlanChange } from "@/lib/membership/service";

// What the member can do with their membership under the owner's rules, and
// what each choice would cost or when it would take effect.
export const GET = memberRoute({}, async ({ db, member }) => {
  const me = await db.member.findUniqueOrThrow({
    where: { id: member.id },
    select: {
      status: true,
      createdAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      stripeSubscriptionId: true,
      planId: true,
      pendingPlanId: true,
      cancelAt: true,
      pausedFrom: true,
      pausedUntil: true,
      membershipPlan: { select: { priceCents: true, interval: true } },
    },
  });
  const plans = await listPlans(db);
  const now = new Date();
  const hasMembership = me.status !== "PENDING" && me.status !== "CANCELED";
  const pausesThisYear = await db.membershipEvent.count({ where: { memberId: member.id, type: "PAUSE_SCHEDULED", createdAt: { gte: new Date(now.getTime() - 365 * 86_400_000) } } });
  const policies = gym.policies;
  return json({
    hasMembership,
    selfServe: hasMembership && Boolean(me.stripeSubscriptionId),
    plans: plans.map((plan) => ({
      ...plan,
      current: plan.id === me.planId,
      pending: plan.id === me.pendingPlanId,
      change: hasMembership && plan.id !== me.planId ? previewPlanChange(me, plan, now) : null,
    })),
    cancellation: {
      allowed: hasMembership && policies.cancellation.allowMemberSelfCancel && !me.cancelAt,
      scheduledFor: me.cancelAt,
      preview: hasMembership && !me.cancelAt ? cancellationTerms(me.createdAt, {}, policies.cancellation, now) : null,
      noticeDays: policies.cancellation.noticeDays,
      coolingOffDays: policies.cancellation.coolingOffDays,
      minimumTermWeeks: policies.cancellation.minimumTermWeeks,
    },
    pause: {
      allowed: hasMembership && policies.pause.allowMemberSelfPause && !me.cancelAt && !(me.pausedUntil && me.pausedUntil > now) && pausesThisYear < policies.pause.maxPausesPerYear,
      current: me.pausedUntil && me.pausedUntil > now ? { from: me.pausedFrom, until: me.pausedUntil } : null,
      minDays: policies.pause.minDays,
      maxDays: policies.pause.maxDays,
      maxPausesPerYear: policies.pause.maxPausesPerYear,
      pausesUsed: pausesThisYear,
      feeCents: policies.pause.feeCents,
    },
  });
});
