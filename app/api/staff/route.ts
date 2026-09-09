import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import type { StaffRoleName } from "@/lib/roles";

const VALID_ROLES: StaffRoleName[] = ["OWNER", "MANAGER", "FRONT_DESK"];

export async function GET(request: Request) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  const staff = await prisma.staff.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json(staff);
}

export async function POST(request: Request) {
  const denied = await requireRole(request, "OWNER");
  if (denied) return denied;

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const role = body?.role as StaffRoleName;

    if (!name || !email || password.length < 8 || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Name, email, a valid role, and a password of at least 8 characters are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.staff.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "A staff account with that email already exists" }, { status: 409 });
    }

    const staff = await prisma.staff.create({
      data: { name, email, role, passwordHash: await hashPassword(password) },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "staff.created",
      targetType: "Staff",
      targetId: staff.id,
      details: { name, email, role },
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error("Staff create error:", error);
    return NextResponse.json({ error: "Failed to create staff account" }, { status: 500 });
  }
}
