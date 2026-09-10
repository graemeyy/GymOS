import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function GET() {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Inventory fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const sku = typeof body?.sku === "string" ? body.sku.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (sku) {
      const existing = await prisma.inventoryItem.findUnique({ where: { sku } });
      if (existing) {
        return NextResponse.json({ error: "An item with that SKU already exists" }, { status: 409 });
      }
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        category: body.category?.trim() || null,
        sku: sku || null,
        quantity: Number.isFinite(Number(body.quantity)) ? Math.max(0, Math.round(Number(body.quantity))) : 0,
        reorderLevel: Number.isFinite(Number(body.reorderLevel)) ? Math.max(0, Math.round(Number(body.reorderLevel))) : 0,
        unitCostCents: body.unitCostCents != null ? Math.max(0, Math.round(Number(body.unitCostCents))) : null,
      },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "inventory.created",
      targetType: "InventoryItem",
      targetId: item.id,
      details: { name: item.name, quantity: item.quantity },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Inventory create error:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
