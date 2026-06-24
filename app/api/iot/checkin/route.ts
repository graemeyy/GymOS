import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { memberId, gatewayId } = await request.json();

    if (!memberId) {
      return NextResponse.json({ error: "Missing member identifier" }, { status: 400 });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { checkIns: true }
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.status !== "ACTIVE") {
      return NextResponse.json({ 
        granted: false, 
        reason: "Subscription status: " + member.status 
      });
    }

    // Log the check-in
    await prisma.checkIn.create({
      data: {
        memberId: member.id,
        location: gatewayId || "Main Entrance"
      }
    });

    // Update retention score logic based on frequency could go here

    return NextResponse.json({ 
      granted: true, 
      memberName: member.name,
      welcomeMessage: "Access Granted. Welcome back, " + (member.name || "Member")
    });

  } catch (error) {
    console.error("IoT Gateway Error:", error);
    return NextResponse.json({ error: "Internal Controller Error" }, { status: 500 });
  }
}
