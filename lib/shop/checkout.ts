import { z } from "zod";
import type Stripe from "stripe";
import type { Db, Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { gym } from "@/lib/config";
import { ApiError } from "@/lib/http/errors";
import { getStripe } from "@/lib/billing/stripe";
import { gstFromInclusive } from "@/lib/money";
import { logAction, type Actor } from "@/lib/audit";
import { commitStock, priceOrder } from "./orders";
import { variantLabel } from "./labels";

const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const;

export const ShippingAddress = z.object({
  line1: z.string().trim().min(1, "Required").max(120),
  line2: z.string().trim().max(120).optional(),
  suburb: z.string().trim().min(1, "Required").max(60),
  state: z.enum(AU_STATES, { error: "Choose a state or territory" }),
  postcode: z.string().trim().regex(/^\d{4}$/, "Four digits"),
});

export const ShopCheckoutBody = z
  .object({
    lines: z
      .array(z.object({ variantId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(20) }))
      .min(1, "Your cart is empty")
      .max(30),
    fulfilment: z.enum(["PICKUP", "SHIPPING"]),
    shippingAddress: ShippingAddress.optional(),
  })
  .refine((b) => b.fulfilment === "PICKUP" || b.shippingAddress, { message: "Add a delivery address", path: ["shippingAddress"] });

export type ShopCheckoutInput = z.infer<typeof ShopCheckoutBody>;

// The discount the member gets right now: their plan's shop discount while
// their membership is active. Signed-up members without a plan, and paused,
// overdue or cancelled memberships, pay the normal price.
export async function memberShopDiscount(db: Db | Tx, memberId: string): Promise<number> {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { status: true, membershipPlan: { select: { shopDiscountPercent: true } } } });
  return member.status === "ACTIVE" ? member.membershipPlan?.shopDiscountPercent ?? 0 : 0;
}

// Prices the cart on the server (the browser's prices are never trusted),
// creates a pending order, and opens a Stripe Checkout page for it. Stock is
// checked now and taken when payment succeeds.
export async function startShopCheckout(db: Db, actor: Actor & { kind: "member" }, input: ShopCheckoutInput) {
  if (input.fulfilment === "SHIPPING" && gym.policies.shop.pickupOnly) {
    throw new ApiError("validation_failed", "Orders are collected from the gym; delivery isn't offered.", { fulfilment: "Pickup only" });
  }
  const quantities = new Map<string, number>();
  for (const line of input.lines) quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity);

  const variants = await db.productVariant.findMany({
    where: { id: { in: [...quantities.keys()] }, active: true, product: { active: true } },
    include: { product: { select: { name: true, category: true } } },
  });
  if (variants.length !== quantities.size) throw new ApiError("conflict", "Something in your cart is no longer sold. Remove it and try again.");
  for (const v of variants) {
    const wanted = quantities.get(v.id)!;
    if (v.stockQty < wanted) {
      throw new ApiError("conflict", v.stockQty === 0 ? `${v.product.name} (${variantLabel(v)}) is sold out.` : `Only ${v.stockQty} of ${v.product.name} (${variantLabel(v)}) left.`);
    }
  }

  const member = await db.member.findUniqueOrThrow({ where: { id: actor.id }, select: { name: true, email: true, stripeCustomerId: true } });
  const discountPercent = await memberShopDiscount(db, actor.id);
  const priced = priceOrder(
    variants.map((v) => ({ variantId: v.id, quantity: quantities.get(v.id)!, unitPriceCents: v.priceCents })),
    discountPercent,
    input.fulfilment
  );
  if (priced.totalCents < 50) throw new ApiError("validation_failed", "The order total is too small to pay by card.");

  const byId = new Map(variants.map((v) => [v.id, v]));
  const order = await db.order.create({
    data: {
      memberId: actor.id,
      email: member.email,
      customerName: member.name ?? member.email,
      fulfilment: input.fulfilment,
      subtotalCents: priced.subtotalCents,
      discountCents: priced.discountCents,
      discountPercent,
      shippingCents: priced.shippingCents,
      totalCents: priced.totalCents,
      gstCents: priced.gstCents,
      shippingAddress: input.fulfilment === "SHIPPING" ? input.shippingAddress : undefined,
      items: {
        create: priced.lines.map((l) => {
          const v = byId.get(l.variantId)!;
          return { variantId: v.id, productName: v.product.name, variantLabel: variantLabel(v), category: v.product.category, unitPriceCents: l.unitPriceCents, quantity: l.quantity, lineTotalCents: l.lineTotalCents };
        }),
      },
      events: { create: { status: "PENDING_PAYMENT", note: "Checkout started", actorName: `Member: ${actor.name}` } },
    },
  });

  // Each line goes to Stripe as one item at its discounted line total, so the
  // amount charged is exactly the order total, with no per-unit rounding.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priced.lines.map((l) => {
    const v = byId.get(l.variantId)!;
    return {
      quantity: 1,
      price_data: {
        currency: "aud",
        unit_amount: l.lineTotalCents,
        product_data: { name: `${v.product.name} (${variantLabel(v)})${l.quantity > 1 ? ` x ${l.quantity}` : ""}`, ...(discountPercent ? { description: `Includes ${discountPercent}% member discount` } : {}) },
      },
    };
  });
  if (priced.shippingCents > 0) lineItems.push({ quantity: 1, price_data: { currency: "aud", unit_amount: priced.shippingCents, product_data: { name: "Shipping" } } });

  const appUrl = env().NEXT_PUBLIC_APP_URL;
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        // Card only, so a completed checkout means the order is paid (R-24).
        payment_method_types: ["card"],
        line_items: lineItems,
        client_reference_id: actor.id,
        metadata: { orderId: order.id, memberId: actor.id, kind: "shop" },
        payment_intent_data: { metadata: { orderId: order.id } },
        ...(member.stripeCustomerId ? { customer: member.stripeCustomerId } : { customer_email: member.email }),
        // Stripe's shortest allowed expiry. An abandoned order is cancelled
        // when Stripe reports it expired.
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${appUrl}/member/orders/${order.id}?paid=1`,
        cancel_url: `${appUrl}/shop/cart`,
      },
      { idempotencyKey: `shop-checkout-${order.id}` }
    );
  } catch (error) {
    await db.order.delete({ where: { id: order.id } });
    if (error instanceof ApiError) throw error;
    throw new ApiError("upstream_failed", "Stripe couldn't start the payment. Nothing was charged. Try again shortly.");
  }
  if (!session.url) {
    await db.order.delete({ where: { id: order.id } });
    throw new ApiError("upstream_failed", "Stripe didn't return a payment link. Nothing was charged. Try again.");
  }
  await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });
  await logAction(db, actor, { action: "order.checkout_started", targetType: "Order", targetId: order.id, details: { number: order.number, totalCents: priced.totalCents, discountPercent } });
  return { url: session.url, orderId: order.id };
}

// Stripe says the shop payment succeeded. Records the payment, takes the
// stock, and marks the order paid, once. If something sold out between
// checkout and payment, the money is still recorded and the order is flagged
// for staff to refund or restock, rather than losing track of a payment.
export async function recordShopPayment(tx: Tx, session: Stripe.Checkout.Session): Promise<{ orderId: string; confirmed: boolean } | null> {
  const orderId = session.metadata?.orderId;
  if (!orderId || session.payment_status !== "paid") return null;
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  if (!rows[0]) {
    console.warn(`Stripe shop payment for unknown order ${orderId}`);
    return null;
  }
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: { select: { id: true } } } });
  if (order.payment) return { orderId, confirmed: false };
  if (!order.memberId) throw new Error(`Shop order ${orderId} has no member`);
  const amount = session.amount_total ?? order.totalCents;
  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  await tx.payment.create({
    data: {
      memberId: order.memberId,
      amount,
      gstCents: amount === order.totalCents ? order.gstCents : gstFromInclusive(amount, gym.business.gstRegistered),
      currency: session.currency ?? "aud",
      status: "succeeded",
      stripePaymentIntentId: intentId,
      description: `Shop order ${order.number}`,
      kind: "SHOP",
      orderId,
    },
  });

  let stockNote: string | null = null;
  await tx.$executeRaw`SAVEPOINT take_stock`;
  try {
    await commitStock(tx, orderId);
    await tx.$executeRaw`RELEASE SAVEPOINT take_stock`;
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT take_stock`;
    if (!(error instanceof ApiError)) throw error;
    stockNote = `Paid, but ${error.message.replace(/\.$/, "")}. Refund the order or restock before fulfilling.`;
  }
  const wasCancelled = order.status === "CANCELLED";
  await tx.order.update({ where: { id: orderId }, data: { status: "PAID", paidAt: new Date() } });
  await tx.orderEvent.create({
    data: { orderId, status: "PAID", note: stockNote ?? (wasCancelled ? "Paid after the order was cancelled. Check before fulfilling." : "Paid by card"), actorName: "Stripe" },
  });
  await logAction(tx, { kind: "system", name: "Stripe" }, { action: stockNote ? "order.paid_stock_short" : "order.paid", targetType: "Order", targetId: orderId, details: { number: order.number, amount } });
  return { orderId, confirmed: true };
}

// An abandoned checkout: the pending order is cancelled. Stock was never
// taken, so there is nothing to return.
export async function expireShopCheckout(tx: Tx, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;
  const updated = await tx.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
  if (updated.count > 0) await tx.orderEvent.create({ data: { orderId, status: "CANCELLED", note: "Checkout wasn't completed", actorName: "Stripe" } });
}
