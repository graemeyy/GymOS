import { z } from "zod";
import { zCents, zName } from "@/lib/http/route";

export const PlanFields = {
  name: zName,
  description: z.string().trim().max(500).nullable(),
  priceCents: zCents.refine((c) => c > 0, "Set a price"),
  interval: z.enum(["WEEK", "FORTNIGHT", "MONTH", "YEAR"]),
  active: z.boolean(),
  classCreditsPerCycle: z.number().int().min(0).max(1000).nullable(),
  guestPassesPerCycle: z.number().int().min(0).max(100),
  shopDiscountPercent: z.number().int().min(0).max(100),
  guestRateCents: zCents,
};

export const CreatePlanBody = z.object({ ...PlanFields, description: PlanFields.description.optional(), active: PlanFields.active.default(true) });
export const UpdatePlanBody = z.object(PlanFields).partial().refine((b) => Object.keys(b).length > 0, "Nothing to update");
