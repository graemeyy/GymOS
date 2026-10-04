import { setStripeForTests, type StripeClient } from "@/lib/billing/stripe";

export interface StripeCall {
  method: string;
  args: unknown[];
}

// Parameters real Stripe rejects. The fake throws the same way, so a call
// Stripe would refuse can't pass the tests (review R-12).
function checkSubscriptionUpdate(params: unknown) {
  const items = (params as { items?: { price?: string; price_data?: Record<string, unknown> }[] })?.items ?? [];
  for (const item of items) {
    if (item.price_data && "product_data" in item.price_data) {
      throw new Error("Received unknown parameter: items[0][price_data][product_data]");
    }
    if (item.price_data && typeof item.price_data.product !== "string") {
      throw new Error("Missing required param: items[0][price_data][product]");
    }
  }
}

// Records calls; individual methods can be made to fail or return other data.
export function installFakeStripe(overrides: Record<string, (...args: unknown[]) => unknown> = {}) {
  const calls: StripeCall[] = [];
  const handler = (method: string, fallback: (...args: unknown[]) => unknown, check?: (...args: unknown[]) => void) => async (...args: unknown[]) => {
    calls.push({ method, args });
    check?.(...args);
    const fn = overrides[method] ?? fallback;
    return fn(...args);
  };
  const fake = {
    subscriptions: {
      update: handler("subscriptions.update", () => ({}), (_id, params) => checkSubscriptionUpdate(params)),
      cancel: handler("subscriptions.cancel", () => ({})),
      retrieve: handler("subscriptions.retrieve", () => ({ id: "sub", items: { data: [{ id: "si_1" }] } })),
    },
    prices: { create: handler("prices.create", () => ({ id: `price_${calls.length}` })) },
    refunds: {
      create: handler("refunds.create", () => ({ id: `re_${calls.length}` })),
      list: handler("refunds.list", () => ({ data: [], has_more: false })),
    },
    invoices: { pay: handler("invoices.pay", () => ({ id: "in_1", status: "paid" })) },
    checkout: {
      sessions: {
        create: handler("checkout.sessions.create", () => ({ id: `cs_${calls.length}`, url: "https://checkout.stripe.com/test" })),
        expire: handler("checkout.sessions.expire", () => ({})),
      },
    },
    billingPortal: { sessions: { create: handler("billingPortal.sessions.create", () => ({ url: "https://billing.stripe.com/test" })) } },
  };
  setStripeForTests(fake as unknown as StripeClient);
  return { calls, restore: () => setStripeForTests(null) };
}
