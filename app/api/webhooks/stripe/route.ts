import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});
const prisma = new PrismaClient();

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const memberId = session.metadata?.memberId;
    const stripeCustomerId = session.customer as string;
    const stripeSubscriptionId = session.subscription as string;

    if (memberId) {
      await prisma.member.update({
        where: { id: memberId },
        data: {
          stripeCustomerId,
          status: 'ACTIVE',
        },
      });

      await prisma.agentAction.create({
        data: {
          title: 'Subscription Completed',
          description: `Member ${memberId} has successfully subscribed via Stripe.`,
          status: 'APPROVED',
          category: 'BILLING',
          metadata: {
            stripeCustomerId,
            stripeSubscriptionId,
            sessionId: session.id,
          },
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
