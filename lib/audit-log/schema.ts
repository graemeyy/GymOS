import { z } from "zod";
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

export type AuditFilter = z.infer<typeof AuditQuery>;
