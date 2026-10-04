import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import * as catalogue from "@/app/api/shop/products/route";
import * as shopCheckout from "@/app/api/shop/checkout/route";
import * as myOrders from "@/app/api/me/orders/route";
import * as myOrder from "@/app/api/me/orders/[id]/route";
import * as orderById from "@/app/api/orders/[id]/route";
import * as refund from "@/app/api/payments/[id]/refund/route";
import * as webhook from "@/app/api/webhooks/stripe/route";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { useFakeStripe } from "../fake-stripe";

let stripe: ReturnType<typeof useFakeStripe>;
let tee: { id: string };
let whey: { id: string };
let hidden: { id: string };

beforeEach(async () => {
  await resetDb();
  captureEmailsForTests(true);
  stripe = useFakeStripe();
  const apparel = await prisma.product.create({
    data: { name: "Club tee", slug: "club-tee", category: "APPAREL", variants: { create: [{ sku: "T-M", size: "M", colour: "Black", priceCents: 3500, stockQty: 3 }] } },
    include: { variants: true },
  });
  const supplement = await prisma.product.create({
    data: { name: "Whey 1kg", slug: "whey", category: "SUPPLEMENTS", variants: { create: [{ sku: "W-C", flavour: "Chocolate", priceCents: 6995, stockQty: 10 }] } },
    include: { variants: true },
  });
  const retired = await prisma.product.create({
    data: { name: "Old shaker", slug: "old-shaker", category: "ACCESSORIES", active: false, variants: { create: [{ sku: "S-1", priceCents: 1000, stockQty: 5 }] } },
    include: { variants: true },
  });
  tee = apparel.variants[0];
  whey = supplement.variants[0];
  hidden = retired.variants[0];
});
afterEach(() => {
  stripe.restore();
  captureEmailsForTests(false);
});

const asMember = (m: { id: string; name: string | null; email: string; sessionVersion: number }): As => ({ member: m });
const checkout = async (as: As, body: unknown) => call(shopCheckout.POST, await makeRequest("POST", "/api/shop/checkout", { as, body }));

async function sendEvent(type: string, object: Record<string, unknown>, id = `evt_${Math.random().toString(36).slice(2)}`) {
  const payload = JSON.stringify({ id, object: "event", type, data: { object } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  return call(webhook.POST, new Request("http://localhost/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": signature }, body: payload }));
}

async function paidSession(orderId: string, amount: number, intent = "pi_shop_1") {
  return { id: "cs_test", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: amount, currency: "aud", payment_intent: intent, metadata: { orderId } };
}

describe("catalogue", () => {
  it("lists active products without stock counts, with the signed-in member's discount", async () => {
    const anon = await call(catalogue.GET, await makeRequest("GET", "/api/shop/products"));
    expect(anon.status).toBe(200);
    expect(anon.body.discountPercent).toBe(0);
    const text = JSON.stringify(anon.body);
    expect(text).not.toContain("Old shaker");
    expect(text).not.toContain("stockQty");
    const m = await createMember({ planSlug: "unlimited" });
    const signedIn = await call(catalogue.GET, await makeRequest("GET", "/x", { as: asMember(m) }));
    expect(signedIn.body.discountPercent).toBe(10);
  });
});

describe("checkout", () => {
  it("prices on the server with the member discount and sends Stripe exactly the order total", async () => {
    const m = await createMember({ planSlug: "unlimited" });
    const res = await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity: 2 }, { variantId: whey.id, quantity: 1 }], fulfilment: "PICKUP" });
    expect(res.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.orderId as string }, include: { items: true } });
    // 2 x 35.00 = 70.00 less 10% = 63.00; 69.95 less 10% = 62.955 -> 62.96 (rounded per line).
    expect(order).toMatchObject({ status: "PENDING_PAYMENT", subtotalCents: 13995, discountCents: 1399, totalCents: 12596, gstCents: 1145, discountPercent: 10, shippingCents: 0, stripeCheckoutSessionId: "cs_1" });
    const params = stripe.calls.find((c) => c.method === "checkout.sessions.create")!.args[0] as { mode: string; line_items: { price_data: { unit_amount: number; currency: string } }[]; metadata: { orderId: string } };
    expect(params.mode).toBe("payment");
    expect(params.metadata.orderId).toBe(order.id);
    expect(params.line_items.every((l) => l.price_data.currency === "aud")).toBe(true);
    expect(params.line_items.reduce((s, l) => s + l.price_data.unit_amount, 0)).toBe(order.totalCents);
  });

  it("ignores prices sent by the browser", async () => {
    const m = await createMember({ planSlug: "off-peak" });
    const res = await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity: 1, unitPriceCents: 1 }], fulfilment: "PICKUP", totalCents: 1 });
    expect(res.status).toBe(201);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: res.body.orderId as string } })).totalCents).toBe(3500);
  });

  it("adds flat shipping under the free-shipping threshold and needs an Australian address", async () => {
    const m = await createMember({ planSlug: "off-peak" });
    const noAddress = await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity: 1 }], fulfilment: "SHIPPING" });
    expect(noAddress.status).toBe(422);
    const badPostcode = await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity: 1 }], fulfilment: "SHIPPING", shippingAddress: { line1: "1 Test St", suburb: "Newtown", state: "NSW", postcode: "204" } });
    expect(badPostcode.body.error?.fields?.["shippingAddress.postcode"]).toBeTruthy();
    const address = { line1: "1 Test St", suburb: "Newtown", state: "NSW", postcode: "2042" };
    const small = await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity: 1 }], fulfilment: "SHIPPING", shippingAddress: address });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: small.body.orderId as string } })).toMatchObject({ shippingCents: 1000, totalCents: 4500 });
    const big = await checkout(asMember(m), { lines: [{ variantId: whey.id, quantity: 2 }], fulfilment: "SHIPPING", shippingAddress: address });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: big.body.orderId as string } })).toMatchObject({ shippingCents: 0, totalCents: 13990 });
  });

  it("refuses sold-out, retired and over-stock items", async () => {
    const m = await createMember();
    expect((await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity: 4 }], fulfilment: "PICKUP" })).status).toBe(409);
    expect((await checkout(asMember(m), { lines: [{ variantId: hidden.id, quantity: 1 }], fulfilment: "PICKUP" })).status).toBe(409);
    expect((await checkout(asMember(m), { lines: [], fulfilment: "PICKUP" })).status).toBe(422);
    expect(await prisma.order.count()).toBe(0);
  });

  it("gives no discount to members without an active membership", async () => {
    const m = await createMember({ planSlug: "unlimited", status: "PAST_DUE" });
    const res = await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity: 1 }], fulfilment: "PICKUP" });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: res.body.orderId as string } })).toMatchObject({ discountPercent: 0, totalCents: 3500 });
  });

  it("leaves no order behind if Stripe fails, and needs a member session", async () => {
    stripe.restore();
    stripe = useFakeStripe({ "checkout.sessions.create": () => { throw new Error("Stripe down"); } });
    const m = await createMember();
    const res = await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity: 1 }], fulfilment: "PICKUP" });
    expect(res.status).toBe(502);
    expect(await prisma.order.count()).toBe(0);
    expect((await checkout(null, { lines: [{ variantId: tee.id, quantity: 1 }], fulfilment: "PICKUP" })).status).toBe(401);
    expect((await checkout({ staff: await createStaff("OWNER") }, { lines: [{ variantId: tee.id, quantity: 1 }], fulfilment: "PICKUP" })).status).toBe(401);
  });
});

describe("payment webhook", () => {
  async function pendingOrder(quantity = 1) {
    const m = await createMember({ planSlug: "off-peak" });
    const res = await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity }], fulfilment: "PICKUP" });
    return { member: m, orderId: res.body.orderId as string };
  }

  it("records the payment with GST, takes stock, marks the order paid and emails once", async () => {
    const { orderId } = await pendingOrder(2);
    const session = await paidSession(orderId, 7000);
    expect((await sendEvent("checkout.session.completed", session, "evt_paid")).status).toBe(200);
    expect((await sendEvent("checkout.session.completed", session, "evt_paid")).body).toMatchObject({ result: "duplicate" });
    expect((await sendEvent("checkout.session.completed", session, "evt_paid_again")).status).toBe(200);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payment: true } });
    expect(order).toMatchObject({ status: "PAID", stockCommitted: true });
    expect(order.paidAt).not.toBeNull();
    expect(order.payment).toMatchObject({ amount: 7000, gstCents: 636, kind: "SHOP", stripePaymentIntentId: "pi_shop_1" });
    expect(order.payment?.invoiceNumber).toBeGreaterThan(0);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: tee.id } })).stockQty).toBe(1);
    const emails = capturedEmails().filter((e) => e.subject.includes("confirmed"));
    expect(emails).toHaveLength(1);
    expect(emails[0].text).toContain("includes $6.36 GST");
  });

  it("keeps the payment and flags the order when stock ran out before payment", async () => {
    const { orderId } = await pendingOrder(3);
    await prisma.productVariant.update({ where: { id: tee.id }, data: { stockQty: 1 } });
    await sendEvent("checkout.session.completed", await paidSession(orderId, 10500));
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { events: true, payment: true } });
    expect(order).toMatchObject({ status: "PAID", stockCommitted: false });
    expect(order.payment?.amount).toBe(10500);
    expect(order.events.find((e) => e.status === "PAID")?.note).toContain("out of stock");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: tee.id } })).stockQty).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "order.paid_stock_short" } })).toBe(1);
  });

  it("cancels an abandoned checkout and hides it from the member's orders", async () => {
    const { member, orderId } = await pendingOrder();
    await sendEvent("checkout.session.expired", { id: "cs_test", object: "checkout.session", mode: "payment", metadata: { orderId } });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CANCELLED");
    const list = await call(myOrders.GET, await makeRequest("GET", "/x", { as: asMember(member) }));
    expect(list.body).toEqual([]);
  });

  it("refunds flow to the order, stock, finance and the customer", async () => {
    const { member, orderId } = await pendingOrder();
    await sendEvent("checkout.session.completed", await paidSession(orderId, 3500));
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    const manager = { staff: await createStaff("MANAGER") };
    const res = await call(refund.POST, await makeRequest("POST", "/x", { as: manager, body: { amountCents: 3500, reason: "Wrong size", method: "STRIPE" } }), { id: payment.id });
    expect(res.status).toBe(201);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("REFUNDED");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: tee.id } })).stockQty).toBe(3);
    expect(await prisma.refund.findFirstOrThrow({ where: { paymentId: payment.id } })).toMatchObject({ amountCents: 3500, gstCents: 318 });
    const { number } = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(capturedEmails().some((e) => e.subject === `Order ${number} refunded`)).toBe(true);
    const detail = await call(myOrder.GET, await makeRequest("GET", "/x", { as: asMember(member) }), { id: orderId });
    expect(detail.body).toMatchObject({ status: "REFUNDED", payment: { refundedCents: 3500 } });
  });
});

describe("my orders", () => {
  it("shows a member their own orders and status history, and nobody else's", async () => {
    const m = await createMember({ planSlug: "off-peak" });
    const other = await createMember();
    const res = await checkout(asMember(m), { lines: [{ variantId: tee.id, quantity: 1 }], fulfilment: "PICKUP" });
    const orderId = res.body.orderId as string;
    await sendEvent("checkout.session.completed", await paidSession(orderId, 3500));
    const owner = { staff: await createStaff("OWNER") };
    await call(orderById.PATCH, await makeRequest("PATCH", "/x", { as: owner, body: { status: "PACKED", note: "internal note" } }), { id: orderId });
    await call(orderById.PATCH, await makeRequest("PATCH", "/x", { as: owner, body: { status: "READY_FOR_PICKUP" } }), { id: orderId });
    expect(capturedEmails().some((e) => e.subject.includes("ready to collect"))).toBe(true);

    const list = await call(myOrders.GET, await makeRequest("GET", "/x", { as: asMember(m) }));
    expect((list.body as unknown as unknown[]).length).toBe(1);
    const detail = await call(myOrder.GET, await makeRequest("GET", "/x", { as: asMember(m) }), { id: orderId });
    expect(detail.status).toBe(200);
    expect((detail.body.events as { status: string }[]).map((e) => e.status)).toEqual(["PENDING_PAYMENT", "PAID", "PACKED", "READY_FOR_PICKUP"]);
    expect(JSON.stringify(detail.body)).not.toContain("internal note");
    expect((await call(myOrder.GET, await makeRequest("GET", "/x", { as: asMember(other) }), { id: orderId })).status).toBe(404);
  });
});
