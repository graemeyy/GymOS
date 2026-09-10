import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      where: { startTime: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      orderBy: { startTime: "asc" },
      include: {
        bookings: {
          include: { member: { select: { id: true, name: true, email: true } } },
        },
        waitlist: {
          orderBy: { createdAt: "asc" },
          include: { member: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    return NextResponse.json(classes);
  } catch (error) {
    console.error("Classes fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { name, instructor, startTime, durationMinutes, capacity } = body;

    if (!name || !startTime) {
      return NextResponse.json({ error: "Name and start time are required" }, { status: 400 });
    }

    const cls = await prisma.class.create({
      data: {
        name,
        instructor: instructor || null,
        startTime: new Date(startTime),
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        capacity: capacity ? Number(capacity) : undefined,
      },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "class.created",
      targetType: "Class",
      targetId: cls.id,
      details: { name: cls.name, startTime: cls.startTime },
    });

    return NextResponse.json(cls, { status: 201 });
  } catch (error) {
    console.error("Class create error:", error);
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
  }
}
