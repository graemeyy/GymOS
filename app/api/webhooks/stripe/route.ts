import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

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
    console.error(\`Webhook signature verification failed.\`, err.message);
    return NextResponse.json({ error: \`Webhook Error: \${err.message}\` }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.memberId;
      const stripeCustomerId = session.customer as string;
      const stripeSubscriptionId = session.subscription as string;
      
      // Determine plan from metadata (fallback to BASIC)
      const planString = session.metadata?.plan?.toUpperCase() || 'BASIC';
      const validPlans = ['BASIC', 'PREMIUM', 'PLATINUM', 'ELITE'];
      const plan = validPlans.includes(planString) ? planString : 'BASIC';

      if (memberId) {
        await prisma.member.update({
          where: { id: memberId },
          data: {
            stripeCustomerId,
            stripeSubscriptionId,
            plan: plan as any,
            status: 'ACTIVE',
          },
        });

        await prisma.agentAction.create({
          data: {
            title: 'Subscription Completed',
            description: \`Member \${memberId} has successfully subscribed to \${plan} plan.\`,
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
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.member.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'CANCELED' },
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      if (subscriptionId) {
        await prisma.member.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: 'PAST_DUE' },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
