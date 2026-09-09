import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function GET() {
  const actions = await prisma.agentAction.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(actions);
}

export async function PATCH(req: Request) {
  const denied = await requireRole(req, "MANAGER");
  if (denied) return denied;

  try {
    const { id, status } = await req.json();
    const updated = await prisma.agentAction.update({
      where: { id },
      data: { status },
    });

    const session = await getSession(req);
    await logAction(prisma, session, {
      action: "agent_action.updated",
      targetType: "AgentAction",
      targetId: id,
      details: { title: updated.title, status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update action" }, { status: 500 });
  }
}
