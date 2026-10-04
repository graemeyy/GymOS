import type { Db } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { formatAud } from "@/lib/money";
import type { ApprovalDecision, EquipmentInput } from "./schema";

export function createEquipment(db: Db, staff: StaffActor, input: EquipmentInput) {
  return db.$transaction(async (tx) => {
    const equipment = await tx.equipment.create({ data: { ...input, serialNumber: input.serialNumber || null } });
    await logAction(tx, staff, { action: "equipment.created", targetType: "Equipment", targetId: equipment.id, details: { name: equipment.name } });
    return equipment;
  });
}

// Drafts a purchase order for a part, waiting for approval. A second request
// while one is pending returns the pending one instead of drafting another.
export function draftPurchaseOrder(db: Db, staff: StaffActor, equipmentId: string) {
  return db.$transaction(async (tx) => {
    const equipment = await tx.equipment.findUnique({ where: { id: equipmentId } });
    if (!equipment) throw new ApiError("not_found", "Equipment not found.");
    if (equipment.status !== "OFFLINE") throw new ApiError("conflict", "Purchase orders can only be drafted for offline equipment.");

    const existing = await tx.agentAction.findFirst({
      where: { category: "MAINTENANCE", status: "PENDING", metadata: { path: ["equipmentId"], equals: equipmentId } },
    });
    if (existing) return { action: existing, isNew: false };

    const cost = equipment.estimatedCost != null ? formatAud(equipment.estimatedCost) : "to be quoted";
    const action = await tx.agentAction.create({
      data: {
        title: `Purchase order: ${equipment.name}`,
        description: `Replacement part for ${equipment.name} (serial ${equipment.serialNumber ?? "unknown"}). Part: ${equipment.partNeeded ?? "to be confirmed"}. Estimated cost ${cost}, GST inclusive.`,
        category: "MAINTENANCE",
        metadata: { equipmentId, serialNumber: equipment.serialNumber, costCents: equipment.estimatedCost },
      },
    });
    await logAction(tx, staff, { action: "equipment.po_created", targetType: "Equipment", targetId: equipmentId, details: { name: equipment.name } });
    return { action, isNew: true };
  });
}

// The status condition makes the check and the write one statement, so two
// managers can't both decide the same request.
export function decideApproval(db: Db, staff: StaffActor, decision: ApprovalDecision) {
  return db.$transaction(async (tx) => {
    const result = await tx.agentAction.updateMany({ where: { id: decision.id, status: "PENDING" }, data: { status: decision.status } });
    if (result.count === 0) throw new ApiError("conflict", "That request has already been decided or doesn't exist.");
    const updated = await tx.agentAction.findUniqueOrThrow({ where: { id: decision.id } });
    await logAction(tx, staff, { action: "approval.decided", targetType: "AgentAction", targetId: decision.id, details: { title: updated.title, status: decision.status } });
    return updated;
  });
}
