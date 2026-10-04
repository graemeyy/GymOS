import Stripe from "stripe";
import * as webhook from "@/app/api/webhooks/stripe/route";
import { call } from "./helpers";

let counter = 0;

// Sends a signed Stripe event to the webhook route, as Stripe would.
export async function sendStripeEvent(type: string, object: Record<string, unknown>, opts: { id?: string; created?: number; apiVersion?: string } = {}) {
  const payload = JSON.stringify({
    id: opts.id ?? `evt_test_${Date.now()}_${counter++}`,
    object: "event",
    api_version: opts.apiVersion ?? "2023-10-16",
    created: opts.created ?? Math.floor(Date.now() / 1000),
    type,
    data: { object },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  return call(webhook.POST, new Request("http://localhost:3000/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": signature }, body: payload }));
}
