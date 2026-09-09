import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      where: { startTime: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      orderBy: { startTime: "asc" },
      include: {
        bookings: {
          include: { member: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    return NextResponse.json(classes);
  } catch (error) {
    console.error("Classes fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, instructor, startTime, durationMinutes, capacity } = body;

    if (!name || !startTime) {
      return NextResponse.json({ error: "Name and start time are required" }, { status: 400 });
    }

    const cls = await prisma.class.create({
      data: {
        name,
        instructor: instructor || null,
        startTime: new Date(startTime),
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        capacity: capacity ? Number(capacity) : undefined,
      },
    });
    return NextResponse.json(cls, { status: 201 });
  } catch (error) {
    console.error("Class create error:", error);
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
  }
}
