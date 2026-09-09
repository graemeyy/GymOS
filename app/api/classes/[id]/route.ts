import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  try {
    const cls = await prisma.class.findUnique({ where: { id: params.id } });
    await prisma.class.delete({ where: { id: params.id } });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "class.canceled",
      targetType: "Class",
      targetId: params.id,
      details: { name: cls?.name, startTime: cls?.startTime },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Class delete error:", error);
    return NextResponse.json({ error: "Failed to cancel class" }, { status: 500 });
  }
}
