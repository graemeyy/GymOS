import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { buildTaxInvoice, type TaxInvoice } from "./invoice";
import { invoiceLinesForPayment } from "./invoice-lines";
import type { PaymentListFilter } from "./payments";

// Search matches the member's name or email, or an invoice number with or
// without its "INV-" prefix.
export function listPayments(db: Db, filter: PaymentListFilter) {
  const invoiceNumber = filter.q?.replace(/^INV-/i, "");
  const where: Prisma.PaymentWhereInput = {
    ...(filter.kind ? { kind: filter.kind } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.q
      ? {
          OR: [
            { member: { name: { contains: filter.q, mode: "insensitive" } } },
            { member: { email: { contains: filter.q, mode: "insensitive" } } },
            ...(invoiceNumber && /^\d+$/.test(invoiceNumber) ? [{ invoiceNumber: Number(invoiceNumber) }] : []),
          ],
        }
      : {}),
  };
  return db.payment.findMany({
    where,
    orderBy: { paidAt: "desc" },
    take: filter.take,
    select: {
      id: true,
      amount: true,
      gstCents: true,
      refundedCents: true,
      currency: true,
      status: true,
      kind: true,
      description: true,
      invoiceNumber: true,
      paidAt: true,
      member: { select: { id: true, name: true, email: true, membershipPlan: { select: { name: true } } } },
    },
  });
}

export function getPayment(db: Db, id: string) {
  return db.payment.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, name: true, email: true } },
      refunds: { orderBy: { createdAt: "desc" } },
      order: { select: { id: true, number: true, status: true } },
    },
  });
}

export function listPaymentsForMember(db: Db, memberId: string) {
  return db.payment.findMany({
    where: { memberId },
    orderBy: { paidAt: "desc" },
    take: 50,
    select: { id: true, invoiceNumber: true, amount: true, gstCents: true, refundedCents: true, currency: true, status: true, description: true, kind: true, paidAt: true },
  });
}

async function taxInvoiceFor(db: Db, where: Prisma.PaymentWhereInput): Promise<TaxInvoice | null> {
  const payment = await db.payment.findFirst({ where, include: { member: { select: { name: true, email: true } } } });
  if (!payment) return null;
  return buildTaxInvoice({ ...payment, lines: await invoiceLinesForPayment(db, payment) });
}

export function getTaxInvoice(db: Db, paymentId: string) {
  return taxInvoiceFor(db, { id: paymentId });
}

// Someone else's payment reads as missing, the same as one that doesn't exist.
export function getTaxInvoiceForMember(db: Db, memberId: string, paymentId: string) {
  return taxInvoiceFor(db, { id: paymentId, memberId });
}
