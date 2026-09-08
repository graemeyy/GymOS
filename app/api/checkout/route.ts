import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PLAN_PRICES } from '@/lib/pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: Request) {
  try {
    const { memberId, planId, email } = await req.json();

    if (!memberId || !planId) {
      return NextResponse.json({ error: 'Missing memberId or planId' }, { status: 400 });
    }

    const unitAmount = PLAN_PRICES[planId as keyof typeof PLAN_PRICES];
    if (!unitAmount) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `GymOS ${planId} Membership`,
            },
            unit_amount: unitAmount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
      customer_email: email,
      metadata: {
        memberId,
        plan: planId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
