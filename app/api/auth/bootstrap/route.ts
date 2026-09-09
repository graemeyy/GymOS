import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { logAction } from "@/lib/audit";

// Only ever creates the very first staff account, as OWNER. Once any staff
// account exists, this permanently refuses — it is not a general "create
// staff" endpoint (that's POST /api/staff, which requires an OWNER session).
export async function GET() {
  const count = await prisma.staff.count();
  return NextResponse.json({ needsSetup: count === 0 });
}

export async function POST(request: Request) {
  const existing = await prisma.staff.count();
  if (existing > 0) {
    return NextResponse.json({ error: "Setup has already been completed" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name || !email || password.length < 8) {
    return NextResponse.json(
      { error: "Name, email, and a password of at least 8 characters are required" },
      { status: 400 }
    );
  }

  const staff = await prisma.staff.create({
    data: { name, email, passwordHash: await hashPassword(password), role: "OWNER" },
  });

  await logAction(prisma, { staffId: staff.id, name: staff.name, role: "OWNER", exp: 0 }, {
    action: "staff.created",
    targetType: "Staff",
    targetId: staff.id,
    details: { role: "OWNER", note: "Initial setup" },
  });

  return NextResponse.json({ success: true });
}
