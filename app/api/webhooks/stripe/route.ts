import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Every write a handler makes goes through the transaction client it is given,
// so the whole event either lands or rolls back together with the marker row
// recording that it was processed.
async function handleEvent(tx: Prisma.TransactionClient, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.metadata?.memberId;
      const stripeCustomerId = session.customer as string;
      const stripeSubscriptionId = session.subscription as string;

      const planString = session.metadata?.plan?.toUpperCase() || 'BASIC';
      const validPlans = ['BASIC', 'PREMIUM', 'PLATINUM', 'ELITE'];
      const plan = validPlans.includes(planString) ? planString : 'BASIC';

      if (memberId) {
        await tx.member.update({
          where: { id: memberId },
          data: {
            stripeCustomerId,
            stripeSubscriptionId,
            plan: plan as any,
            status: 'ACTIVE',
          },
        });

        await tx.agentAction.create({
          data: {
            title: 'Subscription Completed',
            description: `Member ${memberId} has successfully subscribed to ${plan} plan.`,
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
      await tx.member.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'CANCELED' },
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      if (subscriptionId) {
        await tx.member.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: 'PAST_DUE' },
        });
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      if (subscriptionId) {
        const member = await tx.member.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });
        if (member) {
          await tx.payout.create({
            data: {
              memberId: member.id,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: 'succeeded',
            },
          });

          // Stripe retries a failed payment on its own and fires this event
          // when one works, so a member parked on PAST_DUE by
          // invoice.payment_failed is current again and should regain entry.
          // Only PAST_DUE is cleared: CANCELED and PAUSED are deliberate
          // states that a stray charge must not quietly undo.
          if (member.status === 'PAST_DUE') {
            await tx.member.update({
              where: { id: member.id },
              data: { status: 'ACTIVE' },
            });
          }
        }
      }
      break;
    }
  }
}

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

  try {
    await prisma.$transaction(async (tx) => {
      // Claiming the event id first means a redelivery of an event already
      // processed collides on the primary key and aborts here, before any
      // handler runs. Both live in one transaction, so a handler that throws
      // takes the marker down with it and Stripe's retry is free to redo the
      // work rather than being waved through as already done.
      await tx.processedWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });

      await handleEvent(tx, event);
    });
  } catch (err: any) {
    // Duck-typed on purpose: an `instanceof` check can miss when more than one
    // copy of @prisma/client ends up in the bundle, and missing it here would
    // turn every redelivery into a 500 and a retry loop that never settles.
    if (err?.code === 'P2002') {
      console.log(`Webhook event ${event.id} already processed, skipping.`);
      return NextResponse.json({ received: true });
    }

    // Anything else: nothing was committed. Fail loudly so Stripe redelivers
    // instead of recording a success we did not actually achieve.
    console.error(`Webhook handler failed for event ${event.id}:`, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
