import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import type { StaffRoleName } from "@/lib/roles";

const VALID_ROLES: StaffRoleName[] = ["OWNER", "MANAGER", "FRONT_DESK"];

async function remainingOwnerCount(excludeId?: string) {
  return prisma.staff.count({
    where: { role: "OWNER", id: excludeId ? { not: excludeId } : undefined },
  });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, "OWNER");
  if (denied) return denied;

  try {
    const existing = await prisma.staff.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Staff account not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: { name?: string; role?: StaffRoleName; passwordHash?: string } = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      data.name = name;
    }

    if (body.role !== undefined) {
      if (!VALID_ROLES.includes(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      if (existing.role === "OWNER" && body.role !== "OWNER" && (await remainingOwnerCount(existing.id)) === 0) {
        return NextResponse.json({ error: "There must be at least one owner account" }, { status: 400 });
      }
      data.role = body.role;
    }

    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }
      data.passwordHash = await hashPassword(body.password);
    }

    const staff = await prisma.staff.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "staff.updated",
      targetType: "Staff",
      targetId: staff.id,
      details: { name: body.name, role: body.role, passwordReset: body.password !== undefined },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error("Staff update error:", error);
    return NextResponse.json({ error: "Failed to update staff account" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, "OWNER");
  if (denied) return denied;

  try {
    const session = await getSession(request);
    if (session?.staffId === params.id) {
      return NextResponse.json({ error: "You can't remove your own account" }, { status: 400 });
    }

    const existing = await prisma.staff.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Staff account not found" }, { status: 404 });
    }
    if (existing.role === "OWNER" && (await remainingOwnerCount(existing.id)) === 0) {
      return NextResponse.json({ error: "There must be at least one owner account" }, { status: 400 });
    }

    await prisma.staff.delete({ where: { id: params.id } });

    await logAction(prisma, session, {
      action: "staff.deleted",
      targetType: "Staff",
      targetId: params.id,
      details: { name: existing.name, email: existing.email, role: existing.role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Staff delete error:", error);
    return NextResponse.json({ error: "Failed to delete staff account" }, { status: 500 });
  }
}
