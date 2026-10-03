import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { formatAud } from "@/lib/money";

export const POST = staffRoute({ permission: "equipment:manage" }, async ({ params, db, staff }) => {
  const equipment = await db.equipment.findUnique({ where: { id: params.id } });
  if (!equipment) throw new ApiError("not_found", "Equipment not found.");
  if (equipment.status !== "OFFLINE") throw new ApiError("conflict", "Purchase orders can only be drafted for offline equipment.");

  const existing = await db.agentAction.findFirst({
    where: { category: "MAINTENANCE", status: "PENDING", metadata: { path: ["equipmentId"], equals: params.id } },
  });
  if (existing) return json({ message: "A purchase order is already waiting for approval.", action: existing });

  const cost = equipment.estimatedCost != null ? formatAud(equipment.estimatedCost) : "to be quoted";
  const action = await db.agentAction.create({
    data: {
      title: `Purchase order: ${equipment.name}`,
      description: `Replacement part for ${equipment.name} (serial ${equipment.serialNumber ?? "unknown"}). Part: ${equipment.partNeeded ?? "to be confirmed"}. Estimated cost ${cost}, GST inclusive.`,
      category: "MAINTENANCE",
      metadata: { equipmentId: params.id, serialNumber: equipment.serialNumber, costCents: equipment.estimatedCost },
    },
  });
  await logAction(db, staff, { action: "equipment.po_created", targetType: "Equipment", targetId: params.id, details: { name: equipment.name } });
  return json({ message: "Purchase order drafted.", action }, 201);
});
