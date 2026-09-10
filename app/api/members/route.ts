import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function GET() {
  try {
    const members = await prisma.member.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireRole(request, "FRONT_DESK");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { name, email, status, plan, referredById } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    if (referredById) {
      const referrer = await prisma.member.findUnique({ where: { id: referredById }, select: { id: true } });
      if (!referrer) {
        return NextResponse.json({ error: "Referring member not found" }, { status: 400 });
      }
    }

    const member = await prisma.member.create({
      data: {
        name,
        email,
        status: status || "ACTIVE",
        plan: plan || "BASIC",
        referredById: referredById || null,
      }
    });

    const session = await getSession(request);
    await logAction(prisma, session, { action: "member.created", targetType: "Member", targetId: member.id, details: { name, email, plan: member.plan, referredById: member.referredById } });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Create member error:", error);
    return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { id, name, email, status, plan, referredById } = body;

    if (!id) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
    }

    if (referredById && referredById === id) {
      return NextResponse.json({ error: "A member can't refer themselves" }, { status: 400 });
    }

    if (referredById) {
      const referrer = await prisma.member.findUnique({ where: { id: referredById }, select: { id: true } });
      if (!referrer) {
        return NextResponse.json({ error: "Referring member not found" }, { status: 400 });
      }
    }

    const member = await prisma.member.update({
      where: { id },
      data: { name, email, status, plan, referredById: referredById || null }
    });

    const session = await getSession(request);
    await logAction(prisma, session, { action: "member.updated", targetType: "Member", targetId: member.id, details: { name, email, status, plan, referredById: member.referredById } });

    return NextResponse.json(member);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}

class StripeCancelError extends Error {}

export async function DELETE(request: Request) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
    }

    const existing = await prisma.member.findUnique({
      where: { id },
      select: { name: true, email: true, stripeSubscriptionId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    try {
      // The Stripe cancel call runs inside the transaction, after clearing
      // this member's dependent rows but before deleting the member itself.
      // If it fails, the whole transaction (including the dependent-row
      // deletes) rolls back, so we never end up with a canceled
      // subscription attached to a member row that failed to delete.
      await prisma.$transaction(async (tx) => {
        await tx.checkIn.deleteMany({ where: { memberId: id } });
        await tx.payout.deleteMany({ where: { memberId: id } });
        await tx.classBooking.deleteMany({ where: { memberId: id } });
        await tx.classWaitlist.deleteMany({ where: { memberId: id } });

        if (existing.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
          } catch (stripeError) {
            throw new StripeCancelError(
              stripeError instanceof Error ? stripeError.message : "Stripe cancel failed"
            );
          }
        }

        await tx.member.delete({ where: { id } });
      });
    } catch (err) {
      if (err instanceof StripeCancelError) {
        console.error("Failed to cancel Stripe subscription:", err);
        return NextResponse.json(
          { error: "Failed to cancel the member's Stripe subscription; member was not deleted" },
          { status: 502 }
        );
      }
      throw err;
    }

    const session = await getSession(request);
    await logAction(prisma, session, { action: "member.deleted", targetType: "Member", targetId: id, details: existing });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Member delete error:", error);
    return NextResponse.json({ error: "Failed to delete member" }, { status: 500 });
  }
}
