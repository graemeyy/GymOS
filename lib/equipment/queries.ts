import type { Db } from "@/lib/db";

export function listEquipment(db: Db) {
  return db.equipment.findMany({ orderBy: { createdAt: "desc" } });
}

// The approval queue currently holds only equipment purchase orders.
export function listMaintenanceApprovals(db: Db) {
  return db.agentAction.findMany({ where: { category: "MAINTENANCE" }, orderBy: { createdAt: "desc" }, take: 100 });
}
