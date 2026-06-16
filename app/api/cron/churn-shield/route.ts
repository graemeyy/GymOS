import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const members = await prisma.member.findMany({
      include: {
        checkIns: {
          where: {
            timestamp: { gte: thirtyDaysAgo },
          },
        },
      },
    });

    const now = new Date().getTime();

    const updates = members.map((member) => {
      let score = 0;

      // 1. Recency (50%)
      if (member.lastCheckIn) {
        const daysSince = (now - new Date(member.lastCheckIn).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince <= 3) score += 50;
        else if (daysSince <= 7) score += 30;
        else if (daysSince <= 14) score += 10;
      }

      // 2. Frequency (50%)
      const count = member.checkIns.length;
      if (count >= 12) score += 50;
      else if (count >= 8) score += 35;
      else if (count >= 4) score += 15;

      return prisma.member.update({
        where: { id: member.id },
        data: { retentionScore: score },
      });
    });

    await Promise.all(updates);

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error("Churn Shield Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
