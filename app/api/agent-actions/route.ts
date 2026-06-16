import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const actions = await prisma.agentAction.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(actions);
}

export async function PATCH(req: Request) {
  try {
    const { id, status } = await req.json();
    const updated = await prisma.agentAction.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update action" }, { status: 500 });
  }
}
