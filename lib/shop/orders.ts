import type { OrderStatus, Prisma } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";
import { gym } from "@/lib/config";
import { applyDiscount, gstFromInclusive } from "@/lib/money";
import { ApiError } from "@/lib/http/errors";
import { logAction, type Actor } from "@/lib/audit";
import { ORDER_STATUS_TEXT } from "./labels";

export { ORDER_STATUS_TEXT, variantLabel } from "./labels";

// Which status changes staff can make by hand. Refunds go through the refund
// action (money first, then status), never by just relabelling the order.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["PACKED", "CANCELLED"],
  PACKED: ["READY_FOR_PICKUP", "SHIPPED", "PAID"],
  READY_FOR_PICKUP: ["COMPLETED", "PACKED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function allowedTransitions(status: OrderStatus, fulfilment: "PICKUP" | "SHIPPING"): OrderStatus[] {
  return TRANSITIONS[status].filter((next) => (fulfilment === "PICKUP" ? next !== "SHIPPED" : next !== "READY_FOR_PICKUP"));
}

export interface PricedLine {
  variantId: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

// Prices are GST-inclusive. The member discount applies per line, rounded to
// the cent, and shipping is added after discount. GST is 1/11 of the total.
export function priceOrder(lines: { variantId: string; quantity: number; unitPriceCents: number }[], discountPercent: number, fulfilment: "PICKUP" | "SHIPPING") {
  const priced: PricedLine[] = lines.map((l) => ({ ...l, lineTotalCents: applyDiscount(l.unitPriceCents * l.quantity, discountPercent) }));
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const afterDiscount = priced.reduce((s, l) => s + l.lineTotalCents, 0);
  const shop = gym.policies.shop;
  const freeShipping = shop.freeShippingOverCents !== null && afterDiscount >= shop.freeShippingOverCents;
  const shippingCents = fulfilment === "SHIPPING" && !freeShipping ? shop.flatShippingCents : 0;
  const totalCents = afterDiscount + shippingCents;
  return {
    lines: priced,
    subtotalCents,
    discountCents: subtotalCents - afterDiscount,
    shippingCents,
    totalCents,
    gstCents: gstFromInclusive(totalCents, gym.business.gstRegistered),
  };
}

// Takes stock for a paid order exactly once. Fails (and leaves everything
// untouched) if any variant has run out in the meantime.
export async function commitStock(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.stockCommitted) return false;
  for (const item of order.items) {
    const res = await tx.productVariant.updateMany({ where: { id: item.variantId, stockQty: { gte: item.quantity } }, data: { stockQty: { decrement: item.quantity } } });
    if (res.count === 0) throw new ApiError("conflict", `${item.productName} (${item.variantLabel}) is out of stock.`);
  }
  await tx.order.update({ where: { id: orderId }, data: { stockCommitted: true } });
  return true;
}

export async function restock(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (!order.stockCommitted) return;
  for (const item of order.items) {
    await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.quantity } } });
  }
  await tx.order.update({ where: { id: orderId }, data: { stockCommitted: false } });
}

export async function updateOrderStatus(
  db: Db,
  actor: Actor,
  orderId: string,
  next: OrderStatus,
  extra: { note?: string; trackingNumber?: string; restockItems?: boolean } = {}
) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    if (!rows[0]) throw new ApiError("not_found", "Order not found.");
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!allowedTransitions(order.status, order.fulfilment).includes(next)) {
      throw new ApiError("conflict", `An order that is "${ORDER_STATUS_TEXT[order.status]}" can't be marked "${ORDER_STATUS_TEXT[next]}".`);
    }
    if (next === "SHIPPED" && !extra.trackingNumber?.trim()) {
      throw new ApiError("validation_failed", "Add a tracking number when marking an order shipped.", { trackingNumber: "Required" });
    }
    if (next === "CANCELLED" && order.status !== "PENDING_PAYMENT") {
      // A paid order must be refunded first so the money and the books match.
      throw new ApiError("conflict", "This order has been paid. Refund it instead of cancelling.");
    }
    if (next === "CANCELLED" && extra.restockItems !== false) await restock(tx, orderId);
    const data: Prisma.OrderUpdateInput = { status: next, ...(extra.trackingNumber ? { trackingNumber: extra.trackingNumber.trim() } : {}) };
    const updated = await tx.order.update({ where: { id: orderId }, data });
    await tx.orderEvent.create({ data: { orderId, status: next, note: extra.note ?? null, actorName: actor.kind === "member" ? `Member: ${actor.name}` : actor.name } });
    await logAction(tx, actor, { action: "order.status_changed", targetType: "Order", targetId: orderId, details: { number: order.number, from: order.status, to: next } });
    return updated;
  });
}
