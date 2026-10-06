import type { BillingInterval, MembershipEventType, Prisma } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";
import { gym, type GymConfig } from "@/lib/config";
import { ApiError } from "@/lib/http/errors";
import { getStripe } from "@/lib/billing/stripe";
import { stripeRecurring } from "@/lib/billing/intervals";
import { logAction, type Actor } from "@/lib/audit";
import type { StaffActor } from "@/lib/auth/session";
import { currentCycle } from "./cycle";
import { prorationCents } from "./proration";
import { monthlyEquivalentCents } from "@/lib/money";
import { countPausesInLastYear } from "./queries";
import { DAY_MS } from "@/lib/time";
import { getBranding } from "@/lib/branding/service";

type Policies = GymConfig["policies"];

function actorName(actor: Actor) {
  return actor.kind === "member" ? `Member: ${actor.name}` : actor.name;
}

async function recordEvent(db: Db | Tx, memberId: string, actor: Actor, type: MembershipEventType, effectiveAt: Date, details?: Prisma.InputJsonValue) {
  await db.membershipEvent.create({ data: { memberId, type, effectiveAt, details, actorName: actorName(actor) } });
}

async function loadMember(db: Db | Tx, memberId: string) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    include: { membershipPlan: true, pendingPlan: true },
  });
  if (!member) throw new ApiError("not_found", "Member not found.");
  if (member.archivedAt) throw new ApiError("conflict", "This member is archived.");
  return member;
}

// Desk changes can be one step of a larger staff edit, so they join the
// caller's transaction when given one.
function inTransaction<T>(db: Db | Tx, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return "$transaction" in db ? db.$transaction(fn) : fn(db);
}

// Wraps a Stripe call so an outage stops the change before the database is
// touched, with a message staff can act on.
async function stripeStep<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("upstream_failed", `Stripe couldn't ${label}. Nothing was changed. Try again shortly.`);
  }
}

// ---------- Pause ----------

export function validatePause(
  input: { from: Date; until: Date; pausesThisYear: number; byMember: boolean },
  policy: Policies["pause"] = gym.policies.pause,
  now = new Date()
) {
  if (input.byMember && !policy.allowMemberSelfPause) throw new ApiError("forbidden", "Pauses are arranged at the front desk.");
  const days = Math.round((input.until.getTime() - input.from.getTime()) / DAY_MS);
  if (input.from.getTime() < now.getTime() - DAY_MS) throw new ApiError("validation_failed", "A pause can't start in the past.", { from: "Choose today or later" });
  if (days < policy.minDays) throw new ApiError("validation_failed", `A pause must be at least ${policy.minDays} days.`, { until: `At least ${policy.minDays} days` });
  if (days > policy.maxDays) throw new ApiError("validation_failed", `A pause can be at most ${policy.maxDays} days.`, { until: `At most ${policy.maxDays} days` });
  if (input.pausesThisYear >= policy.maxPausesPerYear) {
    throw new ApiError("conflict", `The limit of ${policy.maxPausesPerYear} pauses in 12 months has been reached.`);
  }
  return days;
}

export async function pauseMembership(db: Db, actor: Actor, memberId: string, from: Date, until: Date) {
  const member = await loadMember(db, memberId);
  if (member.status === "CANCELED") throw new ApiError("conflict", "A cancelled membership can't be paused.");
  if (member.status === "PENDING") throw new ApiError("conflict", "There's no membership to pause yet.");
  if (member.pausedUntil && member.pausedUntil > new Date()) throw new ApiError("conflict", "This membership already has a pause. Resume it first.");
  // A pause can't overlap a booked cancellation: the daily job would cancel
  // during the pause and later "resume" a cancelled member (R-27).
  if (member.cancelAt) throw new ApiError("conflict", "This membership has a cancellation booked. Withdraw it before pausing.");
  const pausesThisYear = await countPausesInLastYear(db, memberId, new Date());
  const days = validatePause({ from, until, pausesThisYear, byMember: actor.kind === "member" });

  const startsNow = from.getTime() <= Date.now();
  // Stripe's pause takes effect as soon as it's set, so a pause booked for
  // later is sent to Stripe by the daily job on its start date (R-03).
  if (member.stripeSubscriptionId && startsNow) await pauseStripeBilling(member.stripeSubscriptionId, until);
  await db.$transaction(async (tx) => {
    await tx.member.update({ where: { id: memberId }, data: { pausedFrom: from, pausedUntil: until, ...(startsNow ? { status: "PAUSED" } : {}) } });
    await recordEvent(tx, memberId, actor, "PAUSE_SCHEDULED", from, { until: until.toISOString(), days, feeCents: gym.policies.pause.feeCents });
    await logAction(tx, actor, { action: "membership.paused", targetType: "Member", targetId: memberId, details: { from: from.toISOString(), until: until.toISOString(), days } });
  });
}

export async function resumeMembership(db: Db, actor: Actor, memberId: string) {
  const member = await loadMember(db, memberId);
  if (!member.pausedUntil && member.status !== "PAUSED") throw new ApiError("conflict", "This membership isn't paused.");
  if (member.stripeSubscriptionId) {
    await stripeStep("resume the subscription", () => getStripe().subscriptions.update(member.stripeSubscriptionId!, { pause_collection: "" }));
  }
  await db.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: memberId },
      data: { pausedFrom: null, pausedUntil: null, status: member.status === "PAUSED" ? (member.pastDueSince ? "PAST_DUE" : "ACTIVE") : member.status },
    });
    await recordEvent(tx, memberId, actor, "RESUMED", new Date());
    await logAction(tx, actor, { action: "membership.resumed", targetType: "Member", targetId: memberId });
  });
}

// Stripe stops invoicing until the pause ends; "void" means no catch-up charge.
async function pauseStripeBilling(subscriptionId: string, until: Date) {
  await stripeStep("pause the subscription", () =>
    getStripe().subscriptions.update(subscriptionId, { pause_collection: { behavior: "void", resumes_at: Math.floor(until.getTime() / 1000) } })
  );
}

// ---------- Cancel ----------

export interface CancellationTerms {
  effectiveAt: Date;
  withinCoolingOff: boolean;
  reason: "cooling_off" | "notice" | "minimum_term" | "immediate";
}

// When a cancellation takes effect under the owner's rules: immediately in
// the cooling-off period, otherwise after the notice period, and never before
// the minimum term ends. Staff can make it immediate (for example a medical
// or relocation case, or a consumer guarantee remedy).
export function cancellationTerms(
  joinedAt: Date,
  opts: { immediate?: boolean } = {},
  policy: Policies["cancellation"] = gym.policies.cancellation,
  now = new Date()
): CancellationTerms {
  const withinCoolingOff = now.getTime() - joinedAt.getTime() < policy.coolingOffDays * DAY_MS;
  if (opts.immediate) return { effectiveAt: now, withinCoolingOff, reason: "immediate" };
  if (withinCoolingOff) return { effectiveAt: now, withinCoolingOff, reason: "cooling_off" };
  const afterNotice = new Date(now.getTime() + policy.noticeDays * DAY_MS);
  const minimumEnd = new Date(joinedAt.getTime() + policy.minimumTermWeeks * 7 * DAY_MS);
  return minimumEnd > afterNotice
    ? { effectiveAt: minimumEnd, withinCoolingOff, reason: "minimum_term" }
    : { effectiveAt: afterNotice, withinCoolingOff, reason: "notice" };
}

export async function requestCancellation(db: Db, actor: Actor, memberId: string, input: { reason?: string; immediate?: boolean }) {
  const member = await loadMember(db, memberId);
  if (member.status === "CANCELED") throw new ApiError("conflict", "This membership is already cancelled.");
  if (member.status === "PENDING") throw new ApiError("conflict", "There's no membership to cancel.");
  if (member.cancelAt) throw new ApiError("conflict", "A cancellation is already booked. Withdraw it first to change the date.");
  if (actor.kind === "member" && !gym.policies.cancellation.allowMemberSelfCancel) {
    throw new ApiError("forbidden", "Please contact the gym to cancel.");
  }
  if (input.immediate && actor.kind !== "staff") throw new ApiError("forbidden", "Only staff can cancel immediately.");
  // Cooling-off and minimum term run from when this membership started, not
  // from when the person first signed up (R-07).
  const terms = cancellationTerms(member.membershipStartedAt ?? member.createdAt, { immediate: input.immediate });
  const immediate = terms.effectiveAt.getTime() <= Date.now();

  if (member.stripeSubscriptionId) {
    await stripeStep("cancel the subscription", () =>
      immediate
        ? getStripe().subscriptions.cancel(member.stripeSubscriptionId!)
        : getStripe().subscriptions.update(member.stripeSubscriptionId!, { cancel_at: Math.floor(terms.effectiveAt.getTime() / 1000) })
    );
  }
  await db.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: memberId },
      data: immediate
        ? { status: "CANCELED", cancelledAt: terms.effectiveAt, cancelAt: null, cancelReason: input.reason ?? null, pendingPlanId: null, pausedFrom: null, pausedUntil: null }
        : { cancelAt: terms.effectiveAt, cancelReason: input.reason ?? null },
    });
    await recordEvent(tx, memberId, actor, immediate ? "CANCELLED" : "CANCEL_REQUESTED", terms.effectiveAt, { reason: input.reason ?? null, rule: terms.reason });
    await logAction(tx, actor, {
      action: immediate ? "membership.cancelled" : "membership.cancel_requested",
      targetType: "Member",
      targetId: memberId,
      details: { effectiveAt: terms.effectiveAt.toISOString(), rule: terms.reason, reason: input.reason ?? null },
    });
  });
  return terms;
}

export async function withdrawCancellation(db: Db, actor: Actor, memberId: string) {
  const member = await loadMember(db, memberId);
  if (!member.cancelAt) throw new ApiError("conflict", "There's no cancellation to withdraw.");
  if (member.stripeSubscriptionId) {
    await stripeStep("withdraw the cancellation", () => getStripe().subscriptions.update(member.stripeSubscriptionId!, { cancel_at: "" }));
  }
  await db.$transaction(async (tx) => {
    await tx.member.update({ where: { id: memberId }, data: { cancelAt: null, cancelReason: null } });
    await recordEvent(tx, memberId, actor, "CANCEL_WITHDRAWN", new Date());
    await logAction(tx, actor, { action: "membership.cancel_withdrawn", targetType: "Member", targetId: memberId });
  });
}

// ---------- Plan changes ----------

type LoadedMember = Awaited<ReturnType<typeof loadMember>>;

export interface PlanChangePreview {
  upgrade: boolean;
  immediate: boolean;
  effectiveAt: Date;
  // null: Stripe will work it out (a change between billing intervals).
  prorationCents: number | null;
}

// What changing to `plan` would do under the owner's rules, without doing it.
// Used for the member's "change plan" screen and by changePlan itself, so the
// preview and the result can't disagree.
export function previewPlanChange(
  member: { createdAt: Date; membershipStartedAt?: Date | null; currentPeriodStart: Date | null; currentPeriodEnd: Date | null; membershipPlan: { priceCents: number; interval: BillingInterval } | null },
  plan: { priceCents: number; interval: BillingInterval },
  now = new Date()
): PlanChangePreview {
  const current = member.membershipPlan;
  // Compare what each plan costs per month, so a monthly plan isn't called a
  // downgrade from a weekly one just because its price number is bigger (R-28).
  const upgrade = !current || monthlyEquivalentCents(plan.priceCents, plan.interval) >= monthlyEquivalentCents(current.priceCents, current.interval);
  const policy = gym.policies.planChanges;
  const immediate = upgrade ? policy.upgradeProration === "prorate_now" : policy.downgradeTiming === "immediate";
  const cycle = current ? currentCycle(member, current.interval, now) : null;
  // Across billing intervals Stripe works out the proration itself.
  const proration =
    immediate && current && cycle ? (current.interval === plan.interval ? prorationCents(current.priceCents, plan.priceCents, cycle.start, cycle.end, now) : null) : 0;
  return { upgrade, immediate, effectiveAt: immediate ? now : cycle?.end ?? now, prorationCents: proration };
}

// Members can only change a plan they pay for online. Someone who hasn't
// started a membership goes through checkout instead, and someone who pays at
// the front desk changes plans there (otherwise the new price would never be
// charged).
function assertMemberCanSelfServe(actor: Actor, member: LoadedMember) {
  if (actor.kind !== "member") return;
  if (member.status === "PENDING") throw new ApiError("conflict", "Start a membership first.");
  if (!member.stripeSubscriptionId) throw new ApiError("conflict", "Your membership is managed at the front desk. Ask staff to make this change.");
}

export async function changePlan(db: Db, actor: Actor, memberId: string, newPlanId: string, now = new Date()) {
  const member = await loadMember(db, memberId);
  if (member.status === "CANCELED") throw new ApiError("conflict", "Start a new membership instead of changing a cancelled one.");
  assertMemberCanSelfServe(actor, member);
  const plan = await db.membershipPlan.findFirst({ where: { id: newPlanId, active: true } });
  if (!plan) throw new ApiError("validation_failed", "That plan isn't available.", { planId: "Not available" });
  if (plan.id === member.planId) throw new ApiError("conflict", "That's already the current plan.");
  if (plan.id === member.pendingPlanId) throw new ApiError("conflict", "That change is already booked for your next billing date.");

  const current = member.membershipPlan;
  const { upgrade, immediate, effectiveAt, prorationCents: proration } = previewPlanChange(member, plan, now);

  if (member.stripeSubscriptionId) {
    // The new price is created on the fly from the plan (no Stripe price IDs
    // to keep in sync). Stripe prorates when the change is immediate.
    await stripeStep("change the plan", async () => {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(member.stripeSubscriptionId!);
      const itemId = sub.items.data[0]?.id;
      if (!itemId) throw new ApiError("upstream_failed", "The Stripe subscription has no items to change.");
      // Subscription items only take a price (or price data for an existing
      // product), so the plan's price is created first (R-12).
      const price = await stripe.prices.create({
        currency: "aud",
        unit_amount: plan.priceCents,
        recurring: stripeRecurring(plan.interval),
        product_data: { name: `${(await getBranding()).name} ${plan.name} membership` },
        metadata: { planId: plan.id },
      });
      await stripe.subscriptions.update(member.stripeSubscriptionId!, {
        items: [{ id: itemId, price: price.id }],
        proration_behavior: immediate ? "create_prorations" : "none",
        ...(immediate ? {} : { billing_cycle_anchor: "unchanged" }),
        metadata: { planId: plan.id },
      });
    });
  }

  await db.$transaction(async (tx) => {
    await tx.member.update({ where: { id: memberId }, data: immediate ? { planId: plan.id, pendingPlanId: null } : { pendingPlanId: plan.id } });
    await recordEvent(tx, memberId, actor, immediate ? "PLAN_CHANGED" : "PLAN_CHANGE_SCHEDULED", effectiveAt, {
      from: current?.name ?? null,
      to: plan.name,
      prorationCents: proration,
    });
    await logAction(tx, actor, {
      action: immediate ? "membership.plan_changed" : "membership.plan_change_scheduled",
      targetType: "Member",
      targetId: memberId,
      details: { from: current?.id ?? null, to: plan.id, effectiveAt: effectiveAt.toISOString(), prorationCents: proration },
    });
  });
  return { immediate, effectiveAt, prorationCents: proration, upgrade };
}

// ---------- Front-desk billing ----------
// For members who pay at the desk (no Stripe subscription). Members billed
// through Stripe change plan with changePlan and pause or cancel with the
// actions above, so Stripe and GymOS stay in step (R-06).

function assertDeskBilled(member: LoadedMember, what: string) {
  if (member.stripeSubscriptionId && member.status !== "CANCELED") {
    throw new ApiError("conflict", `This member pays by card through Stripe. Use ${what} instead.`);
  }
}

// Starts (or restarts) a membership: a pending sign-up, or someone whose
// membership ended. Cooling-off and minimum term count from now (R-07).
export async function startMembership(db: Db | Tx, actor: Actor, memberId: string, planId?: string | null) {
  const member = await loadMember(db, memberId);
  if (member.status !== "PENDING" && member.status !== "CANCELED") throw new ApiError("conflict", "This membership is already running.");
  const plan = planId ? await db.membershipPlan.findFirst({ where: { id: planId, active: true }, select: { id: true, name: true } }) : member.membershipPlan;
  if (!plan) throw new ApiError("validation_failed", "Choose a plan to start the membership.", { planId: "Required" });
  const now = new Date();
  await inTransaction(db, async (tx) => {
    await tx.member.update({
      where: { id: memberId },
      data: {
        status: "ACTIVE",
        planId: plan.id,
        membershipStartedAt: now,
        stripeSubscriptionId: null,
        cancelAt: null,
        cancelledAt: null,
        cancelReason: null,
        pendingPlanId: null,
        pastDueSince: null,
        amountOwingCents: 0,
        lastFailedInvoiceId: null,
      },
    });
    await recordEvent(tx, memberId, actor, "JOINED", now, { plan: plan.name, billing: "front desk" });
    await logAction(tx, actor, { action: "membership.started", targetType: "Member", targetId: memberId, details: { planId: plan.id } });
  });
}

// An overdue member paid at the desk.
export async function markPaidAtDesk(db: Db | Tx, actor: Actor, memberId: string) {
  const member = await loadMember(db, memberId);
  assertDeskBilled(member, "Retry payment");
  if (member.status !== "PAST_DUE") throw new ApiError("conflict", "This member doesn't owe anything.");
  await inTransaction(db, async (tx) => {
    await tx.member.update({ where: { id: memberId }, data: { status: "ACTIVE", pastDueSince: null, amountOwingCents: 0, lastFailedInvoiceId: null } });
    await logAction(tx, actor, { action: "membership.paid_at_desk", targetType: "Member", targetId: memberId });
  });
}

export async function setPlanAtDesk(db: Db | Tx, actor: Actor, memberId: string, planId: string | null) {
  const member = await loadMember(db, memberId);
  assertDeskBilled(member, "Change plan");
  if (planId === member.planId) return;
  const plan = planId ? await db.membershipPlan.findFirst({ where: { id: planId, active: true }, select: { id: true, name: true } }) : null;
  if (planId && !plan) throw new ApiError("validation_failed", "That plan isn't available.", { planId: "Not available" });
  await inTransaction(db, async (tx) => {
    await tx.member.update({ where: { id: memberId }, data: { planId: plan?.id ?? null, pendingPlanId: null } });
    await recordEvent(tx, memberId, actor, "PLAN_CHANGED", new Date(), { from: member.membershipPlan?.name ?? null, to: plan?.name ?? null, billing: "front desk" });
    await logAction(tx, actor, { action: "membership.plan_changed", targetType: "Member", targetId: memberId, details: { from: member.planId, to: plan?.id ?? null } });
  });
}

// ---------- Failed payments ----------

// Asks Stripe to try the failed invoice again now (Stripe also retries on its
// own schedule). The webhook records the result.
export async function retryFailedPayment(db: Db, staff: StaffActor, memberId: string) {
  const member = await db.member.findUnique({ where: { id: memberId }, select: { lastFailedInvoiceId: true } });
  if (!member) throw new ApiError("not_found", "Member not found.");
  if (!member.lastFailedInvoiceId) throw new ApiError("conflict", "There's no failed Stripe invoice to retry.");
  try {
    const invoice = await getStripe().invoices.pay(member.lastFailedInvoiceId);
    await logAction(db, staff, { action: "billing.payment_retried", targetType: "Member", targetId: memberId, details: { invoiceId: invoice.id, status: invoice.status } });
    return invoice;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const code = (error as { code?: string; type?: string }).code;
    const type = (error as { type?: string }).type;
    await logAction(db, staff, { action: "billing.payment_retry_failed", targetType: "Member", targetId: memberId, details: { code: code ?? type ?? "unknown" } });
    // Say what actually happened, not "declined" for every failure (R-71).
    if (code === "invoice_already_paid" || code === "invoice_not_open") {
      throw new ApiError("conflict", "That invoice has already been paid or closed. Reload to see the member's current status.");
    }
    if (type === "StripeCardError") throw new ApiError("upstream_failed", "The card was declined again. Ask the member to update their card.");
    throw new ApiError("upstream_failed", "Stripe couldn't retry the payment just now. Try again shortly.");
  }
}

// ---------- Scheduled transitions (run daily) ----------

// Starts and ends pauses, applies scheduled plan changes, and completes
// cancellations whose date has arrived. Idempotent: running twice in a day
// changes nothing the second time. Each member's change and its history
// entry are written together, and one member's failure doesn't stop the
// others (R-35).
export async function applyDueTransitions(db: Db, now = new Date()) {
  const system: Actor = { kind: "system", name: "Daily job" };
  // Runs fn for each member; it returns false when there was nothing to do.
  const each = async <T extends { id: string }>(rows: T[], fn: (row: T) => Promise<boolean | void>) => {
    let done = 0;
    for (const row of rows) {
      try {
        if ((await fn(row)) !== false) done++;
      } catch (error) {
        console.error("Membership transition failed for one member:", error instanceof Error ? error.name : "unknown");
      }
    }
    return done;
  };

  const cancelling = await db.member.findMany({ where: { archivedAt: null, cancelAt: { lte: now }, status: { not: "CANCELED" } }, select: { id: true, cancelAt: true } });
  const cancellations = await each(cancelling, (m) =>
    db.$transaction(async (tx) => {
      await tx.member.update({ where: { id: m.id }, data: { status: "CANCELED", cancelledAt: m.cancelAt, cancelAt: null, pendingPlanId: null, pausedFrom: null, pausedUntil: null } });
      await recordEvent(tx, m.id, system, "CANCELLED", m.cancelAt ?? now, { rule: "scheduled" });
    })
  );

  const starting = await db.member.findMany({
    where: { archivedAt: null, status: { in: ["ACTIVE", "PAST_DUE"] }, pausedFrom: { lte: now }, pausedUntil: { gt: now } },
    select: { id: true, stripeSubscriptionId: true, pausedUntil: true },
  });
  const pausesStarted = await each(starting, async (m) => {
    if (m.stripeSubscriptionId) await pauseStripeBilling(m.stripeSubscriptionId, m.pausedUntil!);
    await db.member.update({ where: { id: m.id }, data: { status: "PAUSED" } });
  });

  const resuming = await db.member.findMany({ where: { archivedAt: null, pausedUntil: { lte: now }, status: { not: "CANCELED" } }, select: { id: true, status: true, pastDueSince: true } });
  const pausesEnded = await each(resuming, (m) =>
    db.$transaction(async (tx) => {
      await tx.member.update({ where: { id: m.id }, data: { pausedFrom: null, pausedUntil: null, ...(m.status === "PAUSED" ? { status: m.pastDueSince ? "PAST_DUE" : "ACTIVE" } : {}) } });
      await recordEvent(tx, m.id, system, "RESUMED", now);
    })
  );

  const planChanges = await db.member.findMany({
    where: { archivedAt: null, pendingPlanId: { not: null } },
    select: { id: true, pendingPlanId: true, createdAt: true, membershipStartedAt: true, currentPeriodStart: true, currentPeriodEnd: true, membershipPlan: { select: { interval: true, name: true } }, pendingPlan: { select: { name: true } } },
  });
  const scheduled = await db.membershipEvent.findMany({
    where: { memberId: { in: planChanges.map((m) => m.id) }, type: "PLAN_CHANGE_SCHEDULED" },
    orderBy: { createdAt: "desc" },
    select: { memberId: true, effectiveAt: true },
  });
  const bookedFor = new Map<string, Date>();
  for (const e of scheduled) if (!bookedFor.has(e.memberId)) bookedFor.set(e.memberId, e.effectiveAt);
  const plansApplied = await each(planChanges, async (m) => {
    const booked = bookedFor.get(m.id);
    if (!booked) {
      // A change with no booking record (set outside the usual flow) is
      // scheduled for the end of the current cycle rather than applied at
      // once (R-87).
      const cycle = m.membershipPlan ? currentCycle(m, m.membershipPlan.interval, now) : null;
      await recordEvent(db, m.id, system, "PLAN_CHANGE_SCHEDULED", cycle?.end ?? now, { to: m.pendingPlan?.name ?? null });
      if (cycle) return false;
    } else if (booked > now) {
      return false;
    }
    await db.$transaction(async (tx) => {
      await tx.member.update({ where: { id: m.id }, data: { planId: m.pendingPlanId, pendingPlanId: null } });
      await recordEvent(tx, m.id, system, "PLAN_CHANGED", now, { from: m.membershipPlan?.name ?? null, to: m.pendingPlan?.name ?? null });
    });
  });
  return { pausesStarted, pausesEnded, cancellations, plansApplied };
}
