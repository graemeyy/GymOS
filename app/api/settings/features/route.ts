import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function GET() {
  try {
    const settings = await prisma.gymSettings.findUnique({ where: { id: "singleton" } });
    return NextResponse.json(
      settings || { id: "singleton", requireKeycardForEntry: false, hideRevenueFromFrontDesk: false }
    );
  } catch (error) {
    console.error("Feature settings fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch feature settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await requireRole(request, "OWNER");
  if (denied) return denied;

  try {
    const body = await request.json();
    const requireKeycardForEntry = !!body.requireKeycardForEntry;
    const hideRevenueFromFrontDesk = !!body.hideRevenueFromFrontDesk;

    const settings = await prisma.gymSettings.upsert({
      where: { id: "singleton" },
      update: { requireKeycardForEntry, hideRevenueFromFrontDesk },
      create: { id: "singleton", requireKeycardForEntry, hideRevenueFromFrontDesk },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "settings.features_updated",
      targetType: "GymSettings",
      details: { requireKeycardForEntry, hideRevenueFromFrontDesk },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Feature settings update error:", error);
    return NextResponse.json({ error: "Failed to update feature settings" }, { status: 500 });
  }
}
