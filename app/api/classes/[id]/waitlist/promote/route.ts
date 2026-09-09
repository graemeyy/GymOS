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
      include: { bookings: true, waitlist: true },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    if (cls.bookings.length >= cls.capacity) {
      return NextResponse.json({ error: "Class is full — free up a spot before promoting" }, { status: 400 });
    }
    if (!cls.waitlist.some((w) => w.memberId === memberId)) {
      return NextResponse.json({ error: "Member is not on the waitlist" }, { status: 400 });
    }

    const booking = await prisma.$transaction(async (tx) => {
      await tx.classWaitlist.delete({
        where: { classId_memberId: { classId: params.id, memberId } },
      });
      return tx.classBooking.create({
        data: { classId: params.id, memberId },
      });
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "class.waitlist_promoted",
      targetType: "Class",
      targetId: params.id,
      details: { className: cls.name, memberId },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("Class waitlist promotion error:", error);
    return NextResponse.json({ error: "Failed to promote member from waitlist" }, { status: 500 });
  }
}
