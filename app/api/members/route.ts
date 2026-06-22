import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, plan } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const member = await prisma.member.create({
      data: {
        name,
        email,
        plan: plan || "BASIC",
        status: "ACTIVE",
      },
    });

    return NextResponse.json(member);
  } catch (error: any) {
    console.error("Failed to create member:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A member with this email already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const members = await prisma.member.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}
