import { setStripeForTests, type StripeClient } from "@/lib/billing/stripe";

export interface StripeCall {
  method: string;
  args: unknown[];
}

// Records calls; individual methods can be made to fail.
export function useFakeStripe(overrides: Record<string, (...args: unknown[]) => unknown> = {}) {
  const calls: StripeCall[] = [];
  const handler = (method: string, fallback: (...args: unknown[]) => unknown) => async (...args: unknown[]) => {
    calls.push({ method, args });
    const fn = overrides[method] ?? fallback;
    return fn(...args);
  };
  const fake = {
    subscriptions: {
      update: handler("subscriptions.update", () => ({})),
      cancel: handler("subscriptions.cancel", () => ({})),
      retrieve: handler("subscriptions.retrieve", () => ({ id: "sub", items: { data: [{ id: "si_1" }] } })),
    },
    refunds: { create: handler("refunds.create", () => ({ id: `re_${calls.length}` })) },
    invoices: { pay: handler("invoices.pay", () => ({ id: "in_1", status: "paid" })) },
    checkout: { sessions: { create: handler("checkout.sessions.create", () => ({ id: `cs_${calls.length}`, url: "https://checkout.stripe.com/test" })) } },
    billingPortal: { sessions: { create: handler("billingPortal.sessions.create", () => ({ url: "https://billing.stripe.com/test" })) } },
  };
  setStripeForTests(fake as unknown as StripeClient);
  return { calls, restore: () => setStripeForTests(null) };
}
