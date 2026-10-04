import { beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { POST } from "@/app/api/webhooks/stripe/route";
import { call, createMember, prisma, resetDb } from "../helpers";

const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

function signedRequest(event: object, secret = SECRET) {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost:3000/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": signature, "content-type": "application/json" }, body: payload });
}

const invoice = (id: string, eventId: string, overrides: Record<string, unknown> = {}) => ({
  id: eventId,
  object: "event",
  type: "invoice.paid",
  data: { object: { id, object: "invoice", subscription: "sub_123", customer: "cus_123", amount_paid: 3995, currency: "aud", tax: null, attempt_count: 1, lines: { data: [{ description: "Unlimited membership" }] }, ...overrides } },
});

beforeEach(resetDb);

describe("Stripe webhook", () => {
  it("rejects a missing or wrong signature", async () => {
    const noSig = new Request("http://localhost:3000/api/webhooks/stripe", { method: "POST", body: "{}" });
    expect((await call(POST, noSig)).status).toBe(400);
    expect((await call(POST, signedRequest(invoice("in_1", "evt_1"), "whsec_wrong"))).status).toBe(400);
  });

  it("records a payment once, with GST, even when Stripe retries", async () => {
    const member = await createMember({ stripeSubscriptionId: "sub_123", stripeCustomerId: "cus_123" });
    const event = invoice("in_1", "evt_paid_1");
    const first = await call(POST, signedRequest(event));
    const retry = await call(POST, signedRequest(event));
    expect(first.body.result).toBe("processed");
    expect(retry.body.result).toBe("duplicate");
    const rows = await prisma.payment.findMany({ where: { memberId: member.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 3995, gstCents: 363, currency: "aud", stripeInvoiceId: "in_1" });
  });

  it("the same invoice under two different events (invoice.paid + payment_succeeded) is stored once", async () => {
    const member = await createMember({ stripeSubscriptionId: "sub_123" });
    await call(POST, signedRequest(invoice("in_2", "evt_a")));
    await call(POST, signedRequest({ ...invoice("in_2", "evt_b"), type: "invoice.payment_succeeded" }));
    expect(await prisma.payment.count({ where: { memberId: member.id } })).toBe(1);
  });

  it("a failed payment marks the member past due, and a later payment restores them", async () => {
    const member = await createMember({ stripeSubscriptionId: "sub_123" });
    await call(POST, signedRequest({ ...invoice("in_3", "evt_fail"), type: "invoice.payment_failed" }));
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("PAST_DUE");
    await call(POST, signedRequest(invoice("in_4", "evt_recover")));
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("ACTIVE");
  });

  it("checkout completion links the Stripe subscription and plan to the member", async () => {
    const member = await createMember();
    const plan = await prisma.membershipPlan.findFirstOrThrow({ where: { slug: "unlimited" } });
    const res = await call(
      POST,
      signedRequest({
        id: "evt_checkout",
        object: "event",
        type: "checkout.session.completed",
        data: { object: { id: "cs_1", object: "checkout.session", mode: "subscription", customer: "cus_new", subscription: "sub_new", client_reference_id: member.id, metadata: { memberId: member.id, planId: plan.id } } },
      })
    );
    expect(res.status).toBe(200);
    const updated = await prisma.member.findUniqueOrThrow({ where: { id: member.id } });
    expect(updated).toMatchObject({ stripeCustomerId: "cus_new", stripeSubscriptionId: "sub_new", planId: plan.id, status: "ACTIVE" });
  });

  it("a deleted subscription cancels the membership", async () => {
    const member = await createMember({ stripeSubscriptionId: "sub_del" });
    await call(POST, signedRequest({ id: "evt_del", object: "event", type: "customer.subscription.deleted", data: { object: { id: "sub_del", object: "subscription", status: "canceled", pause_collection: null } } }));
    expect((await prisma.member.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("CANCELED");
  });

  it("acknowledges unrelated event types without changing anything", async () => {
    const res = await call(POST, signedRequest({ id: "evt_other", object: "event", type: "customer.created", data: { object: { id: "cus_x" } } }));
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("ignored");
  });
});
