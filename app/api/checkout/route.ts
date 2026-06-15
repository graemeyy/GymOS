import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { plan, email, memberId } = await req.json();

    const prices: Record<string, string> = {
      BASIC: process.env.STRIPE_PRICE_BASIC!,
      PREMIUM: process.env.STRIPE_PRICE_PREMIUM!,
      PLATINUM: process.env.STRIPE_PRICE_PLATINUM!,
      ELITE: process.env.STRIPE_PRICE_ELITE!,
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: prices[plan],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?canceled=true`,
      customer_email: email,
      metadata: {
        memberId,
        plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
