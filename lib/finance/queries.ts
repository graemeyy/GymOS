import type { Db } from "@/lib/db";

export function listPaymentsPaidBetween(db: Db, from: Date, to: Date) {
  return db.payment.findMany({
    where: { paidAt: { gte: from, lt: to } },
    orderBy: { paidAt: "asc" },
    include: { member: { select: { name: true, email: true } } },
  });
}

export function listRefundsBetween(db: Db, from: Date, to: Date) {
  return db.refund.findMany({
    // Failed refunds never reached the customer (D-116).
    where: { createdAt: { gte: from, lt: to }, failedAt: null },
    orderBy: { createdAt: "asc" },
    include: { payment: { select: { invoiceNumber: true, member: { select: { name: true, email: true } } } } },
  });
}
