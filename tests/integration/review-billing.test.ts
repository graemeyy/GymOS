// Regression tests for the money and Stripe items in docs/REVIEW.md. Each
// test is named after its review ID and failed before the fix.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as refund from "@/app/api/payments/[id]/refund/route";
import * as invoiceRoute from "@/app/api/payments/[id]/invoice/route";
import * as retry from "@/app/api/members/[id]/retry-payment/route";
import * as productById from "@/app/api/products/[id]/route";
import * as orderById from "@/app/api/orders/[id]/route";
import * as checkout from "@/app/api/checkout/route";
import * as shopCheckout from "@/app/api/shop/checkout/route";
import { changePlan } from "@/lib/membership/service";
import { sendPaymentReminders } from "@/lib/billing/reminders";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { installFakeStripe } from "../fake-stripe";
import { sendStripeEvent } from "../stripe-events";

const DAY = 86_400_000;
let manager: As;
let stripe: ReturnType<typeof installFakeStripe> | null = null;

beforeEach(async () => {
  await resetDb();
  manager = { staff: await createStaff("MANAGER") };
  captureEmailsForTests(true);
});
afterEach(() => {
  stripe?.restore();
  stripe = null;
  captureEmailsForTests(false);
  vi.restoreAllMocks();
});

const asMember = (m: { id: string; name: string | null; email: string; sessionVersion: number }): As => ({ member: m });
const refundReq = async (id: string, body: object) => call(refund.POST, await makeRequest("POST", "/x", { as: manager, body }), { id });
const invoiceObject = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  object: "invoice",
  subscription: "sub_123",
  customer: "cus_123",
  amount_paid: 3995,
  amount_due: 3995,
  currency: "aud",
  tax: null,
  attempt_count: 1,
  status_transitions: { paid_at: null },
  lines: { data: [{ description: "Unlimited membership" }] },
  ...overrides,
});
const subscription = (status: string, overrides: Record<string, unknown> = {}) => ({ id: "sub_123", object: "subscription", status, pause_collection: null, metadata: {}, ...overrides });

describe("R-01 first payment arriving before checkout completion", () => {
  it("records the payment and links the member from the subscription metadata", async () => {
    const m = await createMember({ status: "PENDING" });
    const res = await sendStripeEvent("invoice.paid", invoiceObject("in_first", { subscription: "sub_new", customer: "cus_new", subscription_details: { metadata: { memberId: m.id } } }));
    expect(res.status).toBe(200);
    expect(await prisma.payment.findFirst({ where: { stripeInvoiceId: "in_first" } })).toMatchObject({ memberId: m.id, amount: 3995, gstCents: 363 });
    expect(await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ stripeSubscriptionId: "sub_new", stripeCustomerId: "cus_new" });
  });
});

describe("R-08 late or out-of-order subscription events", () => {
  it("a stale 'active' update after deletion doesn't reopen a cancelled membership", async () => {
    const m = await createMember({ stripeSubscriptionId: "sub_123" });
    const t = Math.floor(Date.now() / 1000);
    await sendStripeEvent("customer.subscription.deleted", subscription("canceled"), { created: t });
    await sendStripeEvent("customer.subscription.updated", subscription("active"), { created: t - 60 });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("CANCELED");
    // Even a newer 'active' update can't revive a subscription Stripe deleted.
    await sendStripeEvent("customer.subscription.updated", subscription("active"), { created: t + 60 });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("CANCELED");
  });

  it("a stale 'past_due' update after a payment doesn't lock a paying member out", async () => {
    const m = await createMember({ stripeSubscriptionId: "sub_123", stripeCustomerId: "cus_123" });
    const t = Math.floor(Date.now() / 1000);
    await sendStripeEvent("invoice.paid", invoiceObject("in_ok"), { created: t });
    await sendStripeEvent("customer.subscription.updated", subscription("past_due"), { created: t - 120 });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("ACTIVE");
  });

  it("a genuine move to past due records when it started, so reminders and the grace period work", async () => {
    const m = await createMember({ stripeSubscriptionId: "sub_123" });
    await sendStripeEvent("customer.subscription.updated", subscription("past_due"));
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.status).toBe("PAST_DUE");
    expect(after.pastDueSince).not.toBeNull();
  });
});

describe("R-09 refunds made in the Stripe dashboard", () => {
  it("are fetched from Stripe when the charge in the event doesn't include them", async () => {
    stripe = installFakeStripe({ "refunds.list": () => ({ data: [{ id: "re_dash", amount: 1000, status: "succeeded", reason: "requested_by_customer" }], has_more: false }) });
    const m = await createMember();
    const p = await prisma.payment.create({ data: { memberId: m.id, amount: 3995, gstCents: 363, status: "succeeded", stripePaymentIntentId: "pi_dash" } });
    // Since Stripe API 2022-11-15 the charge in an event has no refunds list.
    await sendStripeEvent("charge.refunded", { id: "ch_1", object: "charge", payment_intent: "pi_dash", amount_refunded: 1000 });
    expect(await prisma.refund.findMany({ where: { paymentId: p.id } })).toMatchObject([{ stripeRefundId: "re_dash", amountCents: 1000 }]);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).refundedCents).toBe(1000);
  });
});

describe("R-10 a card refunded twice", () => {
  it("treats a refund the webhook already recorded as done, without counting it twice", async () => {
    const m = await createMember();
    const p = await prisma.payment.create({ data: { memberId: m.id, amount: 10000, gstCents: 909, status: "succeeded", stripePaymentIntentId: "pi_race" } });
    // Stripe's webhook lands while our request is still waiting on Stripe.
    stripe = installFakeStripe({
      "refunds.create": async () => {
        stripe!.restore();
        stripe = installFakeStripe({ "refunds.list": () => ({ data: [{ id: "re_race", amount: 3000, status: "succeeded" }], has_more: false }) });
        await sendStripeEvent("charge.refunded", { id: "ch_r", object: "charge", payment_intent: "pi_race" });
        return { id: "re_race" };
      },
    });
    const res = await refundReq(p.id, { amountCents: 3000, reason: "Wrong plan", method: "STRIPE", requestId: "11111111-1111-4111-8111-111111111111" });
    expect(res.status).toBe(201);
    expect(await prisma.refund.count({ where: { paymentId: p.id } })).toBe(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).refundedCents).toBe(3000);
  });

  it("uses one idempotency key per refund attempt, so a retry can't refund again", async () => {
    const keys: string[] = [];
    stripe = installFakeStripe({
      "refunds.create": (_params, opts) => {
        const key = (opts as { idempotencyKey: string }).idempotencyKey;
        keys.push(key);
        return { id: `re_${key}` };
      },
    });
    const m = await createMember();
    const p = await prisma.payment.create({ data: { memberId: m.id, amount: 10000, gstCents: 909, status: "succeeded", stripePaymentIntentId: "pi_retry" } });
    const body = { amountCents: 3000, reason: "Wrong plan", method: "STRIPE", requestId: "22222222-2222-4222-8222-222222222222" };
    expect((await refundReq(p.id, body)).status).toBe(201);
    const second = await refundReq(p.id, body);
    expect(second.status).toBe(201);
    expect(new Set(keys).size).toBe(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).refundedCents).toBe(3000);
  });
});

describe("R-11 saving a product doesn't overwrite stock", () => {
  it("ignores the stock in an edit of an existing variant", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const product = await prisma.product.create({
      data: { name: "Club tee", slug: "club-tee", category: "APPAREL", variants: { create: [{ sku: "T-M", size: "M", priceCents: 3500, stockQty: 10 }] } },
      include: { variants: true },
    });
    const v = product.variants[0];
    await prisma.productVariant.update({ where: { id: v.id }, data: { stockQty: 7 } }); // three sold meanwhile
    const res = await call(
      productById.PUT,
      await makeRequest("PUT", "/x", { as: owner, body: { name: "Club tee (fixed typo)", category: "APPAREL", variants: [{ id: v.id, sku: "T-M", size: "M", priceCents: 3500, stockQty: 10 }] } }),
      { id: product.id }
    );
    expect(res.status).toBe(200);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: v.id } })).stockQty).toBe(7);
  });
});

describe("R-12 plan changes for card-paying members", () => {
  it("creates a Stripe price and passes its ID, which Stripe accepts", async () => {
    stripe = installFakeStripe();
    const m = await createMember({ planSlug: "standard", stripeSubscriptionId: "sub_plan" });
    await prisma.member.update({ where: { id: m.id }, data: { createdAt: new Date(Date.now() - 200 * DAY) } });
    const unlimited = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "unlimited" } });
    const result = await changePlan(prisma, { kind: "member", id: m.id, name: m.name ?? "", email: m.email }, m.id, unlimited.id);
    expect(result.immediate).toBe(true);
    expect(stripe.calls.map((c) => c.method)).toEqual(["subscriptions.retrieve", "prices.create", "subscriptions.update"]);
    const update = stripe.calls.find((c) => c.method === "subscriptions.update")!.args[1] as { items: { price: string }[] };
    expect(update.items[0].price).toMatch(/^price_/);
  });
});

describe("R-17 GST on partial refunds", () => {
  it("adds up to exactly the GST collected", async () => {
    const m = await createMember();
    const p = await prisma.payment.create({ data: { memberId: m.id, amount: 2000, gstCents: 182, status: "succeeded" } });
    await refundReq(p.id, { amountCents: 500, reason: "Part", method: "MANUAL" });
    await refundReq(p.id, { amountCents: 1500, reason: "Rest", method: "MANUAL" });
    const refunds = await prisma.refund.findMany({ where: { paymentId: p.id } });
    expect(refunds.reduce((s, r) => s + r.gstCents, 0)).toBe(182);
  });
});

describe("R-18 concurrent partial refunds that complete a payment", () => {
  it("marks the payment refunded and the order refunded", async () => {
    const m = await createMember();
    const order = await prisma.order.create({ data: { memberId: m.id, email: m.email, customerName: "X", status: "PAID", subtotalCents: 10000, totalCents: 10000, gstCents: 909, paidAt: new Date() } });
    const p = await prisma.payment.create({ data: { memberId: m.id, amount: 10000, gstCents: 909, status: "succeeded", kind: "SHOP", orderId: order.id } });
    await Promise.all([refundReq(p.id, { amountCents: 3000, reason: "Part A", method: "MANUAL" }), refundReq(p.id, { amountCents: 7000, reason: "Part B", method: "MANUAL" })]);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ refundedCents: 10000, status: "refunded" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
  });
});

describe("R-19 a real conflict inside a webhook isn't mistaken for a duplicate", () => {
  it("answers with an error so Stripe retries, and doesn't mark the event processed", async () => {
    await createMember({ stripeCustomerId: "cus_taken" });
    const m = await createMember({ status: "PENDING" });
    const res = await sendStripeEvent(
      "checkout.session.completed",
      { id: "cs_x", object: "checkout.session", mode: "subscription", customer: "cus_taken", subscription: "sub_x", client_reference_id: m.id, metadata: { memberId: m.id } },
      { id: "evt_conflict" }
    );
    expect(res.status).toBe(500);
    expect(await prisma.stripeEvent.findUnique({ where: { id: "evt_conflict" } })).toBeNull();
  });
});

describe("R-20 paying an older invoice", () => {
  it("doesn't move the billing period backwards or clear a newer debt", async () => {
    const m = await createMember({ stripeSubscriptionId: "sub_123", stripeCustomerId: "cus_123" });
    const octStart = new Date("2026-10-01T00:00:00Z");
    const novStart = new Date("2026-11-01T00:00:00Z");
    await prisma.member.update({
      where: { id: m.id },
      data: { status: "PAST_DUE", pastDueSince: octStart, lastFailedInvoiceId: "in_oct", amountOwingCents: 3995, currentPeriodStart: octStart, currentPeriodEnd: novStart },
    });
    const sep = { start: Math.floor(new Date("2026-09-01T00:00:00Z").getTime() / 1000), end: Math.floor(octStart.getTime() / 1000) };
    await sendStripeEvent("invoice.paid", invoiceObject("in_sep", { lines: { data: [{ description: "Unlimited", period: sep }] } }));
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after).toMatchObject({ status: "PAST_DUE", lastFailedInvoiceId: "in_oct", amountOwingCents: 3995 });
    expect(after.currentPeriodEnd?.toISOString()).toBe(novStart.toISOString());
  });
});

describe("R-21 a second subscription from a second checkout tab", () => {
  it("doesn't replace the member's existing subscription and is flagged for staff", async () => {
    const m = await createMember({ stripeSubscriptionId: "sub_first", stripeCustomerId: "cus_1" });
    await sendStripeEvent("checkout.session.completed", { id: "cs_2", object: "checkout.session", mode: "subscription", customer: "cus_1", subscription: "sub_second", client_reference_id: m.id, metadata: { memberId: m.id } });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).stripeSubscriptionId).toBe("sub_first");
    expect(await prisma.auditLog.count({ where: { action: "billing.duplicate_subscription", targetId: m.id } })).toBe(1);
  });
});

describe("R-23 when the money was paid", () => {
  it("dates the payment and its tax invoice from Stripe's paid time, not when the webhook ran", async () => {
    const m = await createMember({ stripeSubscriptionId: "sub_123", stripeCustomerId: "cus_123" });
    // 11:50pm on 30 June in Sydney.
    const paidAt = new Date("2026-06-30T13:50:00Z");
    await sendStripeEvent("invoice.paid", invoiceObject("in_eofy", { status_transitions: { paid_at: Math.floor(paidAt.getTime() / 1000) } }));
    const p = await prisma.payment.findFirstOrThrow({ where: { memberId: m.id } });
    expect(p.paidAt.toISOString()).toBe(paidAt.toISOString());
    const inv = await call(invoiceRoute.GET, await makeRequest("GET", "/x", { as: { staff: await createStaff("OWNER") } }), { id: p.id });
    expect(inv.body.issuedAt).toBe(paidAt.toISOString());
  });
});

describe("R-24 checkout accepts cards only", () => {
  it("sets card as the only payment method for memberships and the shop", async () => {
    stripe = installFakeStripe();
    const m = await createMember({ status: "PENDING" });
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { slug: "standard" } });
    await call(checkout.POST, await makeRequest("POST", "/x", { as: asMember(m), body: { planId: plan.id, acceptTerms: true } }));
    const product = await prisma.product.create({ data: { name: "Chalk", slug: "chalk", category: "ACCESSORIES", variants: { create: [{ sku: "C-1", priceCents: 800, stockQty: 5 }] } }, include: { variants: true } });
    await call(shopCheckout.POST, await makeRequest("POST", "/x", { as: asMember(m), body: { lines: [{ variantId: product.variants[0].id, quantity: 1 }], fulfilment: "PICKUP" } }));
    const sessions = stripe.calls.filter((c) => c.method === "checkout.sessions.create").map((c) => c.args[0] as { payment_method_types?: string[] });
    expect(sessions).toHaveLength(2);
    for (const s of sessions) expect(s.payment_method_types).toEqual(["card"]);
  });
});

describe("R-26 webhook API version", () => {
  it("warns when an event uses a different Stripe API version than the app expects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await sendStripeEvent("customer.created", { id: "cus_v", object: "customer" }, { apiVersion: "2025-03-31.basil" });
    expect(warn.mock.calls.some((c) => String(c[0]).includes("API version"))).toBe(true);
  });
});

describe("R-71 retrying a payment", () => {
  it("says what actually went wrong", async () => {
    const m = await createMember({ stripeSubscriptionId: "sub_r" });
    await prisma.member.update({ where: { id: m.id }, data: { lastFailedInvoiceId: "in_r", status: "PAST_DUE", pastDueSince: new Date() } });
    stripe = installFakeStripe({ "invoices.pay": () => { throw Object.assign(new Error("Invoice is already paid"), { type: "StripeInvalidRequestError", code: "invoice_already_paid" }); } });
    const res = await call(retry.POST, await makeRequest("POST", "/x", { as: manager }), { id: m.id });
    expect(res.status).toBe(409);
    expect(res.body.error?.message).toMatch(/already been paid/);
  });
});

describe("R-72 payment reminders", () => {
  it("two overlapping runs send one email", async () => {
    const m = await createMember({ stripeSubscriptionId: "sub_rem" });
    await prisma.member.update({ where: { id: m.id }, data: { status: "PAST_DUE", pastDueSince: new Date(Date.now() - 2 * DAY) } });
    await Promise.all([sendPaymentReminders(prisma), sendPaymentReminders(prisma)]);
    expect(capturedEmails().filter((e) => e.to === m.email)).toHaveLength(1);
  });
});

describe("R-74 cancelling an unpaid shop order", () => {
  it("expires its Stripe checkout so it can't be paid afterwards", async () => {
    stripe = installFakeStripe();
    const owner = { staff: await createStaff("OWNER") };
    const m = await createMember();
    const order = await prisma.order.create({ data: { memberId: m.id, email: m.email, customerName: "X", subtotalCents: 800, totalCents: 800, gstCents: 73, stripeCheckoutSessionId: "cs_open" } });
    const res = await call(orderById.PATCH, await makeRequest("PATCH", "/x", { as: owner, body: { status: "CANCELLED" } }), { id: order.id });
    expect(res.status).toBe(200);
    expect(stripe.calls.find((c) => c.method === "checkout.sessions.expire")?.args[0]).toBe("cs_open");
  });
});
