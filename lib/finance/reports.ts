import type { Db } from "@/lib/db";

export interface FinanceSummary {
  from: Date;
  to: Date;
  grossCents: number;
  gstCollectedCents: number;
  refundsCents: number;
  refundsGstCents: number;
  netCents: number;
  netGstCents: number;
  paymentCount: number;
  byPlan: { name: string; cents: number; count: number }[];
  byProduct: { name: string; category: string; cents: number; quantity: number }[];
  byKind: { kind: string; cents: number }[];
  outstanding: { memberId: string; name: string; email: string; owingCents: number; pastDueSince: Date | null }[];
  outstandingTotalCents: number;
  otherCurrency: { currency: string; cents: number }[];
}

// Money in, refunds out and GST for a period. Only AUD is summed; payments in
// another currency (older rows from before the switch to AUD) are listed
// separately rather than mixed in.
export async function financeSummary(db: Db, from: Date, to: Date): Promise<FinanceSummary> {
  const payments = await db.payment.findMany({
    where: { paidAt: { gte: from, lt: to }, status: { in: ["succeeded", "refunded", "partially_refunded"] } },
    select: { amount: true, gstCents: true, currency: true, kind: true, planName: true, member: { select: { membershipPlan: { select: { name: true } } } } },
  });
  // Failed refunds never reached the customer (D-116).
  const refunds = await db.refund.findMany({
    where: { createdAt: { gte: from, lt: to }, failedAt: null },
    select: { amountCents: true, gstCents: true, payment: { select: { currency: true } } },
  });
  const items = await db.orderItem.findMany({
    where: { order: { paidAt: { gte: from, lt: to }, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } } },
    select: { productName: true, category: true, lineTotalCents: true, quantity: true },
  });
  const owing = await db.member.findMany({
    where: { archivedAt: null, status: "PAST_DUE" },
    select: { id: true, name: true, email: true, amountOwingCents: true, pastDueSince: true },
    orderBy: { pastDueSince: "asc" },
  });

  const aud = payments.filter((p) => p.currency.toLowerCase() === "aud");
  const audRefunds = refunds.filter((r) => r.payment.currency.toLowerCase() === "aud");
  const grossCents = aud.reduce((s, p) => s + p.amount, 0);
  const gstCollectedCents = aud.reduce((s, p) => s + p.gstCents, 0);
  const refundsCents = audRefunds.reduce((s, r) => s + r.amountCents, 0);
  const refundsGstCents = audRefunds.reduce((s, r) => s + r.gstCents, 0);

  const planMap = new Map<string, { cents: number; count: number }>();
  for (const p of aud.filter((x) => x.kind === "MEMBERSHIP")) {
    const name = p.planName ?? p.member.membershipPlan?.name ?? "No plan recorded";
    const row = planMap.get(name) ?? { cents: 0, count: 0 };
    planMap.set(name, { cents: row.cents + p.amount, count: row.count + 1 });
  }
  const productMap = new Map<string, { category: string; cents: number; quantity: number }>();
  for (const i of items) {
    const row = productMap.get(i.productName) ?? { category: i.category, cents: 0, quantity: 0 };
    productMap.set(i.productName, { category: i.category, cents: row.cents + i.lineTotalCents, quantity: row.quantity + i.quantity });
  }
  const kindMap = new Map<string, number>();
  for (const p of aud) kindMap.set(p.kind, (kindMap.get(p.kind) ?? 0) + p.amount);
  const otherMap = new Map<string, number>();
  for (const p of payments.filter((x) => x.currency.toLowerCase() !== "aud")) otherMap.set(p.currency.toUpperCase(), (otherMap.get(p.currency.toUpperCase()) ?? 0) + p.amount);

  return {
    from,
    to,
    grossCents,
    gstCollectedCents,
    refundsCents,
    refundsGstCents,
    netCents: grossCents - refundsCents,
    netGstCents: gstCollectedCents - refundsGstCents,
    paymentCount: aud.length,
    byPlan: [...planMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.cents - a.cents),
    byProduct: [...productMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.cents - a.cents),
    byKind: [...kindMap.entries()].map(([kind, cents]) => ({ kind, cents })),
    outstanding: owing.map((m) => ({ memberId: m.id, name: m.name ?? m.email, email: m.email, owingCents: m.amountOwingCents, pastDueSince: m.pastDueSince })),
    outstandingTotalCents: owing.reduce((s, m) => s + m.amountOwingCents, 0),
    otherCurrency: [...otherMap.entries()].map(([currency, cents]) => ({ currency, cents })),
  };
}
