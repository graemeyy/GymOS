import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { zGymDate, zGymDateEnd, zId } from "@/lib/http/route";

export const AuditQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).default(50),
  cursor: zId.optional(),
  action: z.string().trim().max(60).optional(),
  staffId: zId.optional(),
  targetId: zId.optional(),
  // Plain dates are gym-local days (R-108).
  from: zGymDate.optional(),
  to: zGymDateEnd.optional(),
});

export function auditWhere(q: z.infer<typeof AuditQuery>): Prisma.AuditLogWhereInput {
  return {
    ...(q.action ? { action: { startsWith: q.action } } : {}),
    ...(q.staffId ? { staffId: q.staffId } : {}),
    ...(q.targetId ? { targetId: q.targetId } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } } : {}),
  };
}
