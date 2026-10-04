import type { Db } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";
import { auditWhere } from "./queries";
import type { AuditFilter } from "./schema";

// Taking a copy of the log is itself recorded.
export async function exportAuditLog(db: Db, staff: StaffActor, q: AuditFilter) {
  const rows = await db.auditLog.findMany({ where: auditWhere(q), orderBy: { createdAt: "desc" }, take: 10_000 });
  await logAction(db, staff, { action: "audit.exported", targetType: "AuditLog", details: { rows: rows.length } });
  return rows;
}
