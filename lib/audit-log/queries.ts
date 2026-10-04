import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import type { AuditFilter } from "./schema";

export function auditWhere(q: AuditFilter): Prisma.AuditLogWhereInput {
  return {
    ...(q.action ? { action: { startsWith: q.action } } : {}),
    ...(q.staffId ? { staffId: q.staffId } : {}),
    ...(q.targetId ? { targetId: q.targetId } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } } : {}),
  };
}

// One page, newest first. The id breaks ties between entries written in the
// same millisecond, so the cursor never skips or repeats one.
export async function listAuditLog(db: Db, q: AuditFilter) {
  const rows = await db.auditLog.findMany({
    where: auditWhere(q),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: q.take + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > q.take;
  const items = hasMore ? rows.slice(0, q.take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
