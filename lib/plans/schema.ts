import { z } from "zod";
import { zCents, zName } from "@/lib/http/route";
import { LOCATION_ACCESS } from "@/lib/locations/constants";

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
  // Where the plan lets members in (D-126). SELECTED needs at least one location.
  locationAccess: z.enum(LOCATION_ACCESS),
  locationIds: z.array(z.string().min(1).max(40)).max(50),
};

const selectedNeedsLocations = (b: { locationAccess?: string; locationIds?: string[] }) => b.locationAccess !== "SELECTED" || (b.locationIds?.length ?? 0) > 0;

export const CreatePlanBody = z
  .object({ ...PlanFields, description: PlanFields.description.optional(), active: PlanFields.active.default(true), locationAccess: PlanFields.locationAccess.default("ALL"), locationIds: PlanFields.locationIds.default([]) })
  .refine(selectedNeedsLocations, { message: "Choose at least one location", path: ["locationIds"] });
export const UpdatePlanBody = z
  .object(PlanFields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, "Nothing to update")
  .refine(selectedNeedsLocations, { message: "Choose at least one location", path: ["locationIds"] });

export type CreatePlanInput = z.infer<typeof CreatePlanBody>;
export type UpdatePlanInput = z.infer<typeof UpdatePlanBody>;
