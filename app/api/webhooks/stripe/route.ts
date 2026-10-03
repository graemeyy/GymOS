import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { constructWebhookEvent, type Stripe } from "@/lib/billing/stripe";
import { processStripeEvent } from "@/lib/billing/webhook";

// Not wrapped in publicRoute: Stripe needs the raw body for the signature,
// and doesn't send an Origin header.
export async function POST(request: Request) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(prisma, event);
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error(`Stripe webhook ${event.type} ${event.id} failed:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
