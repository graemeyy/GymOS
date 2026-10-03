import { z } from "zod";
import { staffRoute, json, zId } from "@/lib/http/route";

const Query = z.object({ take: z.coerce.number().int().min(1).max(200).default(50), cursor: zId.optional() });

export const GET = staffRoute({ permission: "audit:read", query: Query }, async ({ query, db }) => {
  const rows = await db.auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > query.take;
  const items = hasMore ? rows.slice(0, query.take) : rows;
  return json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});
