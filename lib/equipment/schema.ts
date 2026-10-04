import { z } from "zod";
import { zId, zName, zCents } from "@/lib/http/route";

export const EquipmentBody = z.object({
  name: zName,
  serialNumber: z.string().trim().max(64).nullable().optional(),
  status: z.enum(["OPERATIONAL", "WARNING", "OFFLINE"]).default("OPERATIONAL"),
  lastServicedAt: z.coerce.date().nullable().optional(),
  partNeeded: z.string().trim().max(200).nullable().optional(),
  estimatedCost: zCents.nullable().optional(),
});

export const ApprovalDecisionBody = z.object({ id: zId, status: z.enum(["APPROVED", "REJECTED"]) });

export type EquipmentInput = z.infer<typeof EquipmentBody>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionBody>;
