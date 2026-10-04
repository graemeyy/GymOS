import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import * as refund from "@/app/api/payments/[id]/refund/route";
import * as invoice from "@/app/api/payments/[id]/invoice/route";
import * as summary from "@/app/api/finance/summary/route";
import * as exportCsv from "@/app/api/finance/export/route";
import * as webhook from "@/app/api/webhooks/stripe/route";
import { sendPaymentReminders } from "@/lib/billing/reminders";
import { captureEmailsForTests, capturedEmails } from "@/lib/email";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { useFakeStripe } from "../fake-stripe";

const DAY = 86_400_000;
let manager: As;
let stripe: ReturnType<typeof useFakeStripe> | null = null;

beforeEach(async () => {
  await resetDb();
  manager = { staff: await createStaff("MANAGER") };
  captureEmailsForTests(true);
});
afterEach(() => {
  stripe?.restore();
  stripe = null;
  captureEmailsForTests(false);
});

async function payment(overrides: { amount?: number; gstCents?: number; stripePaymentIntentId?: string; createdAt?: Date } = {}) {
  const m = await createMember({ name: "=cmd|' /C calc'!A0" });
  return prisma.payment.create({ data: { memberId: m.id, amount: overrides.amount ?? 3995, gstCents: overrides.gstCents ?? 363, status: "succeeded", currency: "aud", planName: "Unlimited", stripePaymentIntentId: overrides.stripePaymentIntentId, createdAt: overrides.createdAt } });
}
const refundReq = async (id: string, body: object, as: As = manager) => call(refund.POST, await makeRequest("POST", "/x", { as, body }), { id });

describe("refunds", () => {
  it("refunds through Stripe, records GST pro rata, and allows partial then remaining", async () => {
    stripe = useFakeStripe();
    const p = await payment({ stripePaymentIntentId: "pi_1" });
    expect((await refundReq(p.id, { amountCents: 1000, reason: "Gym closed for a day", method: "STRIPE" })).status).toBe(201);
    expect(stripe.calls[0].method).toBe("refunds.create");
    expect(stripe.calls[0].args[0]).toMatchObject({ payment_intent: "pi_1", amount: 1000 });
    expect(stripe.calls[0].args[1]).toMatchObject({ idempotencyKey: expect.stringContaining(p.id) });
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(after).toMatchObject({ refundedCents: 1000, status: "partially_refunded" });
    expect((await prisma.refund.findFirstOrThrow({ where: { paymentId: p.id } })).gstCents).toBe(91);
    expect((await refundReq(p.id, { amountCents: 2996, reason: "Too much", method: "STRIPE" })).status).toBe(422);
    expect((await refundReq(p.id, { amountCents: 2995, reason: "Cancelled in cooling-off", method: "STRIPE" })).status).toBe(201);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("refunded");
  });

  it("two refunds at once can't exceed the payment", async () => {
    const p = await payment();
    const results = await Promise.all([1, 2].map(() => refundReq(p.id, { amountCents: 3000, reason: "Double click", method: "MANUAL" })));
    // The loser is refused either at the amount check or by the guarded update.
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409 || r.status === 422)).toHaveLength(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).refundedCents).toBe(3000);
  });

  it("can't refund a non-Stripe payment to a card, and front desk can't refund at all", async () => {
    const p = await payment();
    expect((await refundReq(p.id, { amountCents: 100, reason: "Test", method: "STRIPE" })).status).toBe(409);
    expect((await refundReq(p.id, { amountCents: 100, reason: "Test", method: "MANUAL" }, { staff: await createStaff("FRONT_DESK") })).status).toBe(403);
  });

  it("records refunds made in the Stripe dashboard once, via webhook", async () => {
    const p = await payment({ stripePaymentIntentId: "pi_dash" });
    const event = { id: "evt_refund", object: "event", type: "charge.refunded", data: { object: { id: "ch_1", object: "charge", payment_intent: "pi_dash", refunds: { data: [{ id: "re_dash", amount: 3995, status: "succeeded", reason: "requested_by_customer" }] } } } };
    const send = async (eventId: string) => {
      const payload = JSON.stringify({ ...event, id: eventId });
      const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
      return call(webhook.POST, new Request("http://localhost/x", { method: "POST", headers: { "stripe-signature": signature }, body: payload }));
    };
    await send("evt_refund");
    await send("evt_refund_again");
    expect(await prisma.refund.count({ where: { paymentId: p.id } })).toBe(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("refunded");
  });
});

describe("failed-payment reminders (config: days 1, 3, 7)", () => {
  it("sends each reminder once per overdue episode", async () => {
    const m = await createMember({ status: "PAST_DUE" });
    await prisma.member.update({ where: { id: m.id }, data: { pastDueSince: new Date(Date.now() - 3.5 * DAY), amountOwingCents: 2995 } });
    expect((await sendPaymentReminders(prisma)).remindersSent).toBe(1);
    expect((await sendPaymentReminders(prisma)).remindersSent).toBe(0);
    expect(capturedEmails()[0].text).toMatch(/\$29\.95/);
    expect(await prisma.paymentReminder.findMany({ where: { memberId: m.id }, select: { day: true } })).toEqual([{ day: 3 }]);
  });
});

describe("finance", () => {
  it("summarises takings, refunds and GST, and only sums AUD", async () => {
    stripe = useFakeStripe();
    const p = await payment({ stripePaymentIntentId: "pi_f" });
    await payment({ amount: 2995, gstCents: 272 });
    const m = await createMember();
    await prisma.payment.create({ data: { memberId: m.id, amount: 5000, gstCents: 0, status: "succeeded", currency: "usd" } });
    await refundReq(p.id, { amountCents: 3995, reason: "Refund", method: "STRIPE" });
    const owner = { staff: await createStaff("OWNER") };
    const res = await call(summary.GET, await makeRequest("GET", "/api/finance/summary?period=this-month", { as: owner }));
    expect(res.body).toMatchObject({ grossCents: 6990, gstCollectedCents: 635, refundsCents: 3995, refundsGstCents: 363, netCents: 2995, netGstCents: 272 });
    expect(res.body.otherCurrency).toEqual([{ currency: "USD", cents: 5000 }]);
  });

  it("exports a CSV labelled as a summary, with formulas neutralised", async () => {
    await payment();
    const owner = { staff: await createStaff("OWNER") };
    const res = await call(exportCsv.GET, await makeRequest("GET", "/api/finance/export?type=payments&period=this-month", { as: owner }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const text = String(res.body);
    expect(text.split("\r\n")[1]).toMatch(/not tax advice/);
    expect(text).toContain(",'=cmd|' /C calc'!A0,");
    expect(text).not.toContain(",=cmd");
  });

  it("front desk can't see finance", async () => {
    const res = await call(summary.GET, await makeRequest("GET", "/api/finance/summary", { as: { staff: await createStaff("FRONT_DESK") } }));
    expect(res.status).toBe(403);
  });
});

describe("tax invoice", () => {
  it("shows ABN, GST and a sequential invoice number", async () => {
    const p = await payment();
    const res = await call(invoice.GET, await makeRequest("GET", "/x", { as: manager }), { id: p.id });
    expect(res.body).toMatchObject({ title: "Tax invoice", seller: { abn: "94 687 093 963" }, gstCents: 363, totalCents: 3995 });
    expect(String(res.body.number)).toMatch(/^INV-\d{6}$/);
  });
});
