import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

class PromoteError extends Error {
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

    const { booking, className } = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.findUnique({
        where: { id: params.id },
        include: { bookings: true, waitlist: true },
      });
      if (!cls) {
        throw new PromoteError("Class not found", 404);
      }
      if (cls.bookings.length >= cls.capacity) {
        throw new PromoteError("Class is full — free up a spot before promoting", 400);
      }
      if (!cls.waitlist.some((w) => w.memberId === memberId)) {
        throw new PromoteError("Member is not on the waitlist", 400);
      }

      await tx.classWaitlist.delete({
        where: { classId_memberId: { classId: params.id, memberId } },
      });
      const booking = await tx.classBooking.create({
        data: { classId: params.id, memberId },
      });
      return { booking, className: cls.name };
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "class.waitlist_promoted",
      targetType: "Class",
      targetId: params.id,
      details: { className, memberId },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof PromoteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Class waitlist promotion error:", error);
    return NextResponse.json({ error: "Failed to promote member from waitlist" }, { status: 500 });
  }
}
