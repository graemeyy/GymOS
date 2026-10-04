import Stripe from "stripe";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http/errors";

export type StripeClient = Pick<Stripe, "checkout" | "billingPortal" | "subscriptions" | "webhooks" | "refunds" | "customers" | "invoices">;

let client: StripeClient | null = null;
let override: StripeClient | null = null;

// Created on first use so the app runs (and builds) without Stripe keys.
// Routes that need Stripe answer 503 "not configured" instead of crashing.
export function getStripe(): StripeClient {
  if (override) return override;
  if (client) return client;
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new ApiError("not_configured", "Payments aren't set up yet. Add Stripe test keys to the environment.");
  client = new Stripe(key, { apiVersion: "2023-10-16", typescript: true });
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(override) || Boolean(env().STRIPE_SECRET_KEY);
}

export function setStripeForTests(fake: StripeClient | null) {
  override = fake;
}

// Webhook signature checks don't call Stripe's API, so they work with a
// webhook secret alone.
export function constructWebhookEvent(payload: string, signature: string, secret: string): Stripe.Event {
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}

export type { Stripe };
