import { staffRoute } from "@/lib/http/route";
import { toCsv } from "@/lib/csv";
import { AuditQuery, auditWhere } from "@/lib/audit-query";
import { logAction } from "@/lib/audit";

export const GET = staffRoute({ permission: "audit:read", query: AuditQuery }, async ({ query, db, staff }) => {
  const rows = await db.auditLog.findMany({ where: auditWhere(query), orderBy: { createdAt: "desc" }, take: 10_000 });
  await logAction(db, staff, { action: "audit.exported", targetType: "AuditLog", details: { rows: rows.length } });
  const csv = toCsv(rows, [
    { header: "When (UTC)", value: (r) => r.createdAt.toISOString() },
    { header: "Who", value: (r) => r.staffName },
    { header: "Action", value: (r) => r.action },
    { header: "Record type", value: (r) => r.targetType },
    { header: "Record ID", value: (r) => r.targetId },
    { header: "Details", value: (r) => (r.details ? JSON.stringify(r.details) : "") },
  ]);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="audit-log.csv"', "Cache-Control": "no-store" } });
});
