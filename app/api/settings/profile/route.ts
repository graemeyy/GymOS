import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function GET() {
  try {
    const profile = await prisma.gymProfile.findUnique({ where: { id: "singleton" } });
    return NextResponse.json(
      profile || { id: "singleton", gymName: "GymOS", address: null, timezone: "America/New_York" }
    );
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { gymName, address, timezone } = body;

    if (!gymName) {
      return NextResponse.json({ error: "Gym name is required" }, { status: 400 });
    }

    const profile = await prisma.gymProfile.upsert({
      where: { id: "singleton" },
      update: { gymName, address: address || null, timezone: timezone || "America/New_York" },
      create: { id: "singleton", gymName, address: address || null, timezone: timezone || "America/New_York" },
    });

    const session = await getSession(request);
    await logAction(prisma, session, { action: "profile.updated", targetType: "GymProfile", details: { gymName, address, timezone } });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
