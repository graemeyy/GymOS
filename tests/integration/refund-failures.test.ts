// R-25, D-116: a refund Stripe later reports as failed or cancelled is
// reversed in GymOS. Stripe's events are simulated with signed payloads.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as refund from "@/app/api/payments/[id]/refund/route";
import * as financeSummary from "@/app/api/finance/summary/route";
import { call, createMember, createStaff, makeRequest, prisma, resetDb, type As } from "../helpers";
import { installFakeStripe } from "../fake-stripe";
import { sendStripeEvent } from "../stripe-events";
import { STRIPE_WEBHOOK_EVENTS } from "@/lib/billing/events";

let manager: As;
let stripe: ReturnType<typeof installFakeStripe> | null = null;

beforeEach(async () => {
  await resetDb();
  manager = { staff: await createStaff("MANAGER") };
});
afterEach(() => stripe?.restore());

async function paidAndRefunded(amountCents: number, refundCents: number, refundId = "re_later_fails") {
  stripe = installFakeStripe({ "refunds.create": () => ({ id: refundId, status: "pending" }) });
  const member = await createMember();
  const payment = await prisma.payment.create({ data: { memberId: member.id, amount: amountCents, gstCents: Math.round(amountCents / 11), status: "succeeded", stripePaymentIntentId: `pi_${refundId}` } });
  const res = await call(refund.POST, await makeRequest("POST", "/x", { as: manager, body: { amountCents: refundCents, reason: "Changed their mind", method: "STRIPE" } }), { id: payment.id });
  expect(res.status).toBe(201);
  return payment;
}

const refundObject = (id: string, status: string, extra: Record<string, unknown> = {}) => ({ id, object: "refund", amount: 1000, status, ...extra });

describe("a refund that fails after it was made", () => {
  it("goes back off the payment and is marked failed, with the reason", async () => {
    const payment = await paidAndRefunded(5000, 2000);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("partially_refunded");
    await sendStripeEvent("charge.refund.updated", refundObject("re_later_fails", "failed", { failure_reason: "expired_or_canceled_card" }));
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(after.refundedCents).toBe(0);
    expect(after.status).toBe("succeeded");
    const row = await prisma.refund.findFirstOrThrow({ where: { paymentId: payment.id } });
    expect(row.failedAt).not.toBeNull();
    expect(row.failureReason).toBe("expired_or_canceled_card");
  });

  it("counts once, whichever of Stripe's two event names arrives and however often", async () => {
    const payment = await paidAndRefunded(5000, 2000);
    await sendStripeEvent("refund.updated", refundObject("re_later_fails", "failed"));
    await sendStripeEvent("charge.refund.updated", refundObject("re_later_fails", "failed"));
    await sendStripeEvent("refund.updated", refundObject("re_later_fails", "failed"));
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).refundedCents).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "billing.refund_failed" } })).toBe(1);
  });

  it("leaves other refunds on the payment alone", async () => {
    const payment = await paidAndRefunded(5000, 2000, "re_first");
    stripe!.restore();
    stripe = installFakeStripe({ "refunds.create": () => ({ id: "re_second", status: "succeeded" }) });
    await call(refund.POST, await makeRequest("POST", "/x", { as: manager, body: { amountCents: 1000, reason: "Second", method: "STRIPE" } }), { id: payment.id });
    await sendStripeEvent("refund.updated", refundObject("re_first", "failed"));
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(after.refundedCents).toBe(1000);
    expect(after.status).toBe("partially_refunded");
  });

  it("treats a cancelled refund the same way", async () => {
    const payment = await paidAndRefunded(5000, 5000);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("refunded");
    await sendStripeEvent("refund.updated", refundObject("re_later_fails", "canceled"));
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect([after.refundedCents, after.status]).toEqual([0, "succeeded"]);
    expect((await prisma.refund.findFirstOrThrow({ where: { paymentId: payment.id } })).failureReason).toBe("cancelled");
  });

  it("ignores updates that aren't failures, and refunds GymOS doesn't know", async () => {
    const payment = await paidAndRefunded(5000, 2000);
    await sendStripeEvent("refund.updated", refundObject("re_later_fails", "succeeded"));
    await sendStripeEvent("refund.updated", refundObject("re_unknown", "failed"));
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).refundedCents).toBe(2000);
  });

  it("drops out of the finance figures", async () => {
    const owner = { staff: await createStaff("OWNER") };
    const payment = await paidAndRefunded(5000, 2000);
    await prisma.payment.update({ where: { id: payment.id }, data: { currency: "aud", paidAt: new Date() } });
    const refunds = async () => ((await call(financeSummary.GET, await makeRequest("GET", "/x", { as: owner }))).body as { refundsCents: number }).refundsCents;
    expect(await refunds()).toBe(2000);
    await sendStripeEvent("refund.updated", refundObject("re_later_fails", "failed"));
    expect(await refunds()).toBe(0);
  });

  it("is audited with what to follow up, before and after", async () => {
    const payment = await paidAndRefunded(5000, 2000);
    await sendStripeEvent("refund.updated", refundObject("re_later_fails", "failed", { failure_reason: "lost_or_stolen_card" }));
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: "billing.refund_failed", targetId: payment.id } });
    expect(entry.before).toEqual({ refundedCents: 2000, status: "partially_refunded" });
    expect(entry.after).toEqual({ refundedCents: 0, status: "succeeded" });
    expect(entry.details).toMatchObject({ amountCents: 2000, failureReason: "lost_or_stolen_card", followUp: "The money didn't go back to the customer." });
  });
});

describe("the webhook events GymOS needs", () => {
  it("include the refund update events", () => {
    expect(STRIPE_WEBHOOK_EVENTS).toEqual(expect.arrayContaining(["charge.refunded", "charge.refund.updated", "refund.updated"]));
  });
});
