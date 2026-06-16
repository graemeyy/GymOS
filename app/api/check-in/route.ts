import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { memberId, email } = await req.json();

    if (!memberId && !email) {
      return NextResponse.json(
        { error: "Member ID or email is required" },
        { status: 400 }
      );
    }

    // Find the member
    const member = await prisma.member.findFirst({
      where: {
        OR: [
          { id: memberId || undefined },
          { email: email || undefined }
        ]
      },
      include: {
        checkIns: {
          take: 1,
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Determine status flags
    const isInactive = member.status !== "ACTIVE";
    const needsKeycard = !member.keycardIssued;
    
    // Create the check-in record
    const checkIn = await prisma.checkIn.create({
      data: {
        memberId: member.id,
        location: "Main Entrance",
      }
    });

    // Update last check-in timestamp on member
    await prisma.member.update({
      where: { id: member.id },
      data: { lastCheckIn: new Date() }
    });

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        status: member.status,
        plan: member.plan,
        retentionScore: member.retentionScore,
        keycardIssued: member.keycardIssued,
      },
      checkIn,
      alerts: {
        inactive: isInactive,
        needsKeycard,
        lowRetention: member.retentionScore < 50
      }
    });

  } catch (error) {
    console.error("Check-in error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const checkIns = await prisma.checkIn.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' },
      include: {
        member: {
          select: {
            name: true,
            email: true,
            status: true
          }
        }
      }
    });
    return NextResponse.json(checkIns);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
