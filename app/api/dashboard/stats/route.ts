import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PLAN_PRICES } from "@/lib/pricing";

export async function GET() {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [activeMembers, equipmentAlerts, atRiskMembers, checkInsToday] = await Promise.all([
      prisma.member.findMany({ where: { status: "ACTIVE" }, select: { plan: true } }),
      prisma.equipment.count({ where: { status: { in: ["WARNING", "OFFLINE"] } } }),
      prisma.member.count({ where: { status: "ACTIVE", retentionScore: { lt: 40 } } }),
      prisma.checkIn.count({ where: { timestamp: { gte: startOfDay } } }),
    ]);

    const revenueCents = activeMembers.reduce((sum, m) => sum + (PLAN_PRICES[m.plan] ?? 0), 0);

    return NextResponse.json({
      revenueCents,
      activeMembers: activeMembers.length,
      checkInsToday,
      alerts: equipmentAlerts + atRiskMembers,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to load dashboard stats" }, { status: 500 });
  }
}
