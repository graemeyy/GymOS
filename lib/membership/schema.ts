import { z } from "zod";

export const BenefitAdjustmentBody = z.object({
  kind: z.enum(["CLASS_CREDIT", "GUEST_PASS", "ACCOUNT_CREDIT"]),
  delta: z.number().int().min(-100_000).max(100_000).refine((d) => d !== 0, "Must not be zero"),
  reason: z.string().trim().min(3, "Say why").max(300),
});

export type BenefitAdjustmentInput = z.infer<typeof BenefitAdjustmentBody>;
