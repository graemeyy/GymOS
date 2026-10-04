import { staffRoute } from "@/lib/http/route";
import { toCsv } from "@/lib/csv";
import { AuditQuery } from "@/lib/audit-log/schema";
import { exportAuditLog } from "@/lib/audit-log/service";

export const GET = staffRoute({ permission: "audit.view", query: AuditQuery }, async ({ query, db, staff }) => {
  const rows = await exportAuditLog(db, staff, query);
  const csv = toCsv(rows, [
    { header: "When (UTC)", value: (r) => r.createdAt.toISOString() },
    { header: "Who", value: (r) => r.staffName },
    { header: "Action", value: (r) => r.action },
    { header: "Record type", value: (r) => r.targetType },
    { header: "Record ID", value: (r) => r.targetId },
    { header: "Details", value: (r) => (r.details ? JSON.stringify(r.details) : "") },
    { header: "Old value", value: (r) => (r.before == null ? "" : JSON.stringify(r.before)) },
    { header: "New value", value: (r) => (r.after == null ? "" : JSON.stringify(r.after)) },
  ]);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="audit-log.csv"', "Cache-Control": "no-store" } });
});
