import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

class WaitlistError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, "FRONT_DESK");
  if (denied) return denied;

  try {
    const { memberId } = await request.json();
    if (!memberId) {
      return NextResponse.json({ error: "Member is required" }, { status: 400 });
    }

    const { entry, className } = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.findUnique({
        where: { id: params.id },
        include: { bookings: true, waitlist: true },
      });
      if (!cls) {
        throw new WaitlistError("Class not found", 404);
      }
      if (cls.bookings.length < cls.capacity) {
        throw new WaitlistError("This class still has open spots — book the member directly", 400);
      }
      if (cls.bookings.some((b) => b.memberId === memberId)) {
        throw new WaitlistError("Member is already booked into this class", 400);
      }
      if (cls.waitlist.some((w) => w.memberId === memberId)) {
        throw new WaitlistError("Member is already on the waitlist", 400);
      }

      const entry = await tx.classWaitlist.create({
        data: { classId: params.id, memberId },
      });
      return { entry, className: cls.name };
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "class.waitlisted",
      targetType: "Class",
      targetId: params.id,
      details: { className, memberId },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof WaitlistError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Class waitlist join error:", error);
    return NextResponse.json({ error: "Failed to add member to waitlist" }, { status: 500 });
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

    await prisma.classWaitlist.delete({
      where: { classId_memberId: { classId: params.id, memberId } },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "class.waitlist_removed",
      targetType: "Class",
      targetId: params.id,
      details: { memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Class waitlist removal error:", error);
    return NextResponse.json({ error: "Failed to remove member from waitlist" }, { status: 500 });
  }
}
