import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanPrices, PLAN_PRICES } from "@/lib/pricing";

export async function GET() {
  try {
    const prices = await getPlanPrices(prisma);
    return NextResponse.json(prices);
  } catch (error) {
    console.error("Plan prices fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch plan prices" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const plans = Object.keys(PLAN_PRICES) as (keyof typeof PLAN_PRICES)[];

    for (const plan of plans) {
      const value = body[plan];
      if (value === undefined) continue;
      const priceCents = Math.round(Number(value));
      if (!Number.isFinite(priceCents) || priceCents < 0) {
        return NextResponse.json({ error: `Invalid price for ${plan}` }, { status: 400 });
      }
      await prisma.planPrice.upsert({
        where: { plan },
        update: { priceCents },
        create: { plan, priceCents },
      });
    }

    const prices = await getPlanPrices(prisma);
    return NextResponse.json(prices);
  } catch (error) {
    console.error("Plan prices update error:", error);
    return NextResponse.json({ error: "Failed to update plan prices" }, { status: 500 });
  }
}
