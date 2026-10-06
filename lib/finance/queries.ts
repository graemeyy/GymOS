import type { Db } from "@/lib/db";

export function listPaymentsPaidBetween(db: Db, from: Date, to: Date, locationIds: readonly string[] | null = null) {
  return db.payment.findMany({
    where: { paidAt: { gte: from, lt: to }, ...(locationIds ? { locationId: { in: [...locationIds] } } : {}) },
    orderBy: { paidAt: "asc" },
    include: { member: { select: { name: true, email: true } }, location: { select: { name: true } } },
  });
}

export function listRefundsBetween(db: Db, from: Date, to: Date, locationIds: readonly string[] | null = null) {
  return db.refund.findMany({
    // Failed refunds never reached the customer (D-116).
    where: { createdAt: { gte: from, lt: to }, failedAt: null, ...(locationIds ? { payment: { locationId: { in: [...locationIds] } } } : {}) },
    orderBy: { createdAt: "asc" },
    include: { payment: { select: { invoiceNumber: true, member: { select: { name: true, email: true } } } } },
  });
}
