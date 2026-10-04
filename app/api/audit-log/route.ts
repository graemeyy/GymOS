import { staffRoute, json } from "@/lib/http/route";
import { AuditQuery, auditWhere } from "@/lib/audit-query";

export const GET = staffRoute({ permission: "audit:read", query: AuditQuery }, async ({ query, db }) => {
  const rows = await db.auditLog.findMany({
    where: auditWhere(query),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > query.take;
  const items = hasMore ? rows.slice(0, query.take) : rows;
  return json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});
