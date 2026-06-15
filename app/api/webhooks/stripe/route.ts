import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('Stripe-Signature') as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const session = event.data.object as any;

  if (event.type === 'checkout.session.completed') {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    await prisma.member.update({
      where: { email: session.customer_details.email },
      data: {
        stripeCustomerId: session.customer as string,
        status: 'ACTIVE',
        plan: session.metadata.plan,
      },
    });
  }

  if (event.type === 'invoice.payment_failed') {
    await prisma.member.update({
      where: { stripeCustomerId: session.customer as string },
      data: { status: 'PAST_DUE' },
    });
  }

  return NextResponse.json({ received: true });
}
