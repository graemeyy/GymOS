import type { Db } from "@/lib/db";
import type { InvoiceLine } from "./invoice";

// Shop payments list each item; membership payments are a single line.
export async function invoiceLinesForPayment(db: Db, payment: { orderId: string | null }): Promise<InvoiceLine[] | undefined> {
  if (!payment.orderId) return undefined;
  const order = await db.order.findUnique({ where: { id: payment.orderId }, include: { items: true } });
  if (!order) return undefined;
  const lines: InvoiceLine[] = order.items.map((i) => ({ description: `${i.productName} (${i.variantLabel})`, quantity: i.quantity, amountCents: i.lineTotalCents }));
  if (order.shippingCents > 0) lines.push({ description: "Shipping", quantity: 1, amountCents: order.shippingCents });
  return lines;
}
