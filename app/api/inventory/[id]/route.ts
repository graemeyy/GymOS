import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";

// Stock adjustments are a front-desk action (selling a drink, restocking a
// shelf); editing the item record itself is a manager action.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, "FRONT_DESK");
  if (denied) return denied;

  try {
    const { delta } = await request.json();
    const change = Math.round(Number(delta));

    if (!Number.isFinite(change) || change === 0) {
      return NextResponse.json({ error: "A non-zero delta is required" }, { status: 400 });
    }

    // Guarded atomic update: the `quantity` condition makes the read and the
    // write one operation, so concurrent adjustments can't oversell stock.
    const result = await prisma.inventoryItem.updateMany({
      where: { id: params.id, quantity: { gte: change < 0 ? -change : 0 } },
      data: { quantity: { increment: change } },
    });

    if (result.count === 0) {
      const exists = await prisma.inventoryItem.findUnique({ where: { id: params.id } });
      if (!exists) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Not enough stock on hand" }, { status: 400 });
    }

    const item = await prisma.inventoryItem.findUnique({ where: { id: params.id } });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "inventory.adjusted",
      targetType: "InventoryItem",
      targetId: params.id,
      details: { name: item?.name, delta: change, quantity: item?.quantity },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Inventory adjust error:", error);
    return NextResponse.json({ error: "Failed to adjust stock" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
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
      const clash = await prisma.inventoryItem.findUnique({ where: { sku } });
      if (clash && clash.id !== params.id) {
        return NextResponse.json({ error: "An item with that SKU already exists" }, { status: 409 });
      }
    }

    const item = await prisma.inventoryItem.update({
      where: { id: params.id },
      data: {
        name,
        category: body.category?.trim() || null,
        sku: sku || null,
        quantity: Number.isFinite(Number(body.quantity)) ? Math.max(0, Math.round(Number(body.quantity))) : undefined,
        reorderLevel: Number.isFinite(Number(body.reorderLevel)) ? Math.max(0, Math.round(Number(body.reorderLevel))) : undefined,
        unitCostCents: body.unitCostCents != null ? Math.max(0, Math.round(Number(body.unitCostCents))) : null,
      },
    });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "inventory.updated",
      targetType: "InventoryItem",
      targetId: item.id,
      details: { name: item.name, quantity: item.quantity, reorderLevel: item.reorderLevel },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Inventory update error:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await requireRole(request, "MANAGER");
  if (denied) return denied;

  try {
    const existing = await prisma.inventoryItem.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.inventoryItem.delete({ where: { id: params.id } });

    const session = await getSession(request);
    await logAction(prisma, session, {
      action: "inventory.deleted",
      targetType: "InventoryItem",
      targetId: params.id,
      details: { name: existing.name, quantity: existing.quantity },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Inventory delete error:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
