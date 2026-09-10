import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: params.id },
      include: {
        checkIns: { orderBy: { timestamp: "desc" }, take: 20 },
        payouts: { orderBy: { createdAt: "desc" }, take: 10 },
        classBookings: {
          orderBy: { class: { startTime: "asc" } },
          where: { class: { startTime: { gte: new Date() } } },
          include: { class: { select: { id: true, name: true, startTime: true, instructor: true } } },
        },
        classWaitlist: {
          orderBy: { class: { startTime: "asc" } },
          where: { class: { startTime: { gte: new Date() } } },
          include: { class: { select: { id: true, name: true, startTime: true } } },
        },
        referredBy: { select: { id: true, name: true, email: true } },
        referrals: { select: { id: true, name: true, email: true, createdAt: true } },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Member detail fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch member" }, { status: 500 });
  }
}
