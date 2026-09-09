import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, "FRONT_DESK");
  if (denied) return denied;

  try {
    const { memberId } = await request.json();
    if (!memberId) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 });
    }

    const cls = await prisma.class.findUnique({
      where: { id: params.id },
      include: { bookings: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    if (cls.bookings.length >= cls.capacity) {
      return NextResponse.json({ error: "Class is full" }, { status: 400 });
    }
    if (cls.bookings.some((b) => b.memberId === memberId)) {
      return NextResponse.json({ error: "Member is already booked into this class" }, { status: 400 });
    }

    const booking = await prisma.classBooking.create({
      data: { classId: params.id, memberId },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "class.booked",
      targetType: "Class",
      targetId: params.id,
      details: { className: cls.name, memberId },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Class booking error:", error);
    return NextResponse.json({ error: "Failed to book member" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, "FRONT_DESK");
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 });
    }

    await prisma.classBooking.delete({
      where: { classId_memberId: { classId: params.id, memberId } },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "class.booking_canceled",
      targetType: "Class",
      targetId: params.id,
      details: { memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Class booking cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
