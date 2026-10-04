import { staffRoute } from "@/lib/http/route";
import { toCsv } from "@/lib/csv";
import { AuditQuery } from "@/lib/audit-log/schema";
import { exportAuditLog } from "@/lib/audit-log/service";

export const GET = staffRoute({ permission: "audit:read", query: AuditQuery }, async ({ query, db, staff }) => {
  const rows = await exportAuditLog(db, staff, query);
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
