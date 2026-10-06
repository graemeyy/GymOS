import type { Db } from "@/lib/db";
import { monthlyEquivalentCents } from "@/lib/money";
import { startOfTodayIn } from "@/lib/dates";
import { DAY_MS, HOUR_MS } from "@/lib/time";
import { gym } from "@/lib/config";
import { AT_RISK_BELOW } from "@/lib/retention";

type Revenue = { mrrCents: number; last30Cents: number; byPlan: { name: string; cents: number }[]; byProduct: { name: string; cents: number }[] };

// The staff dashboard figures. Money figures are null when the viewer can't
// see revenue.
// For some locations (null for every location, D-129): members by home
// location, check-ins and orders by where they happened, money by where it's
// reported. Equipment alerts are for the whole gym.
export async function getDashboardStats(db: Db, showRevenue: boolean, now = new Date(), locationIds: readonly string[] | null = null) {
  const at = locationIds ? { in: [...locationIds] } : undefined;
  const home = at ? { homeLocationId: at } : {};
  const here = at ? { locationId: at } : {};
  const tz = gym.business.timezone;
  const startOfDay = startOfTodayIn(tz, now);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since7 = new Date(startOfDay.getTime() - 6 * DAY_MS);

  const [active, newSignups, cancellations, pastDue, owing, checkInsToday, recentCheckIns, atRisk, equipmentAlerts, openOrders] = await Promise.all([
    db.member.findMany({ where: { status: "ACTIVE", archivedAt: null, ...home }, select: { membershipPlan: { select: { priceCents: true, interval: true } } } }),
    db.member.count({ where: { createdAt: { gte: since30 }, ...home } }),
    db.member.count({ where: { cancelledAt: { gte: since30 }, ...home } }),
    db.member.count({ where: { status: "PAST_DUE", archivedAt: null, ...home } }),
    db.member.aggregate({ where: { status: "PAST_DUE", archivedAt: null, ...home }, _sum: { amountOwingCents: true } }),
    db.checkIn.count({ where: { timestamp: { gte: startOfDay }, ...here } }),
    db.checkIn.findMany({ where: { timestamp: { gte: since7 }, ...here }, select: { timestamp: true } }),
    db.member.count({ where: { status: "ACTIVE", archivedAt: null, retentionScore: { lt: AT_RISK_BELOW }, ...home } }),
    db.equipment.count({ where: { status: { in: ["WARNING", "OFFLINE"] } } }),
    db.order.count({ where: { status: { in: ["PAID", "PACKED", "READY_FOR_PICKUP"] }, ...here } }),
  ]);

  // Churn over the last 30 days: cancellations divided by members who were
  // active at the start of the window (active now, plus those who left).
  const base = active.length + cancellations;
  const churnRate = base > 0 ? cancellations / base : 0;

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  const series = Array.from({ length: 7 }, (_, i) => dayKey.format(new Date(since7.getTime() + i * DAY_MS + 12 * HOUR_MS)));
  const counts = new Map(series.map((d) => [d, 0]));
  for (const c of recentCheckIns) {
    const k = dayKey.format(c.timestamp);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  let revenue: null | Revenue = null;
  if (showRevenue) {
    const [payments, items] = await Promise.all([
      db.payment.findMany({ where: { createdAt: { gte: since30 }, currency: "aud", kind: "MEMBERSHIP", ...here }, select: { amount: true, refundedCents: true, planName: true } }),
      db.orderItem.findMany({ where: { order: { paidAt: { gte: since30 }, status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] }, ...here } }, select: { productName: true, lineTotalCents: true } }),
    ]);
    const byPlan = new Map<string, number>();
    for (const p of payments) byPlan.set(p.planName ?? "Other", (byPlan.get(p.planName ?? "Other") ?? 0) + p.amount - p.refundedCents);
    const byProduct = new Map<string, number>();
    for (const i of items) byProduct.set(i.productName, (byProduct.get(i.productName) ?? 0) + i.lineTotalCents);
    revenue = {
      // Estimated from each active member's current plan price, as a monthly figure.
      mrrCents: active.reduce((sum, m) => sum + (m.membershipPlan ? monthlyEquivalentCents(m.membershipPlan.priceCents, m.membershipPlan.interval) : 0), 0),
      last30Cents: [...byPlan.values(), ...byProduct.values()].reduce((a, b) => a + b, 0),
      byPlan: [...byPlan.entries()].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents),
      byProduct: [...byProduct.entries()].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents).slice(0, 8),
    };
  }

  return {
    activeMembers: active.length,
    newSignups30: newSignups,
    cancellations30: cancellations,
    churnRate30: Math.round(churnRate * 1000) / 10,
    pastDue,
    owingCents: showRevenue ? owing._sum.amountOwingCents ?? 0 : null,
    checkInsToday,
    checkIns7: series.map((date) => ({ date, count: counts.get(date) ?? 0 })),
    atRisk,
    equipmentAlerts,
    openOrders,
    mrrCents: revenue?.mrrCents ?? null,
    revenue,
  };
}
