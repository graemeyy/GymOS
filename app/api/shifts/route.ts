import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function GET() {
  try {
    const shifts = await prisma.shift.findMany({
      where: { startTime: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      orderBy: { startTime: "asc" },
      include: { staff: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Shifts fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { staffId, startTime, endTime, notes } = body;

    if (!staffId || !startTime || !endTime) {
      return NextResponse.json({ error: "Staff member, start time, and end time are required" }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { name: true } });
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const shift = await prisma.shift.create({
      data: { staffId, startTime: start, endTime: end, notes: notes || null },
      include: { staff: { select: { id: true, name: true, role: true } } },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "shift.created",
      targetType: "Shift",
      targetId: shift.id,
      details: { staffName: staff.name, startTime: start, endTime: end },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    console.error("Shift create error:", error);
    return NextResponse.json({ error: "Failed to create shift" }, { status: 500 });
  }
}
