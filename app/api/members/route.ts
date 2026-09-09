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
    const { name, email, status, plan } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const member = await prisma.member.create({
      data: {
        name,
        email,
        status: status || "ACTIVE",
        plan: plan || "BASIC"
      }
    });

    const session = await getSession(request);
    await logAction(prisma, session, { action: "member.created", targetType: "Member", targetId: member.id, details: { name, email, plan: member.plan } });

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
    const { id, name, email, status, plan } = body;

    if (!id) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
    }

    const member = await prisma.member.update({
      where: { id },
      data: { name, email, status, plan }
    });

    const session = await getSession(request);
    await logAction(prisma, session, { action: "member.updated", targetType: "Member", targetId: member.id, details: { name, email, status, plan } });

    return NextResponse.json(member);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}

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

    if (existing?.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
      } catch (stripeError) {
        console.error("Failed to cancel Stripe subscription:", stripeError);
        return NextResponse.json(
          { error: "Failed to cancel the member's Stripe subscription; member was not deleted" },
          { status: 502 }
        );
      }
    }

    await prisma.member.delete({
      where: { id }
    });

    const session = await getSession(request);
    await logAction(prisma, session, { action: "member.deleted", targetType: "Member", targetId: id, details: existing ?? undefined });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete member" }, { status: 500 });
  }
}
