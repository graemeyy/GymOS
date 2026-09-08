import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const payouts = await prisma.payout.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { member: { select: { name: true, email: true, plan: true } } },
    });
    return NextResponse.json(payouts);
  } catch (error) {
    console.error("Payouts fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 });
  }
}
