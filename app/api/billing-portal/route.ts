import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { memberId } = await req.json();

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { stripeCustomerId: true },
    });

    if (!member?.stripeCustomerId) {
      return NextResponse.json({ error: 'Stripe Customer ID not found' }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: member.stripeCustomerId,
      return_url: \`\${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard\`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Billing portal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
