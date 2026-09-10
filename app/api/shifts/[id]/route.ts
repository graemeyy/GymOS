import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  try {
    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      include: { staff: { select: { name: true } } },
    });
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    await prisma.shift.delete({ where: { id: params.id } });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "shift.deleted",
      targetType: "Shift",
      targetId: params.id,
      details: { staffName: shift.staff.name, startTime: shift.startTime, endTime: shift.endTime },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shift delete error:", error);
    return NextResponse.json({ error: "Failed to remove shift" }, { status: 500 });
  }
}
