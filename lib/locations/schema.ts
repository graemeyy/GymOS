import { z } from "zod";
import { AU_STATES } from "@/lib/config/constants";

export const LocationBody = z.object({
  name: z.string().trim().min(1, "Required").max(60),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,30}$/, "2 to 30 lowercase letters, numbers or hyphens"),
  addressLine1: z.string().trim().max(120),
  addressLine2: z.string().trim().max(120),
  suburb: z.string().trim().max(60),
  state: z.union([z.enum(AU_STATES), z.literal("")]),
  postcode: z.union([z.string().regex(/^\d{4}$/, "Australian postcodes are four digits"), z.literal("")]),
  phone: z.string().trim().max(30).nullable(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type LocationInput = z.infer<typeof LocationBody>;

export const LocationArchiveBody = z.object({ archived: z.boolean() });

/** `?locationId=` on staff lists and reports; empty means every location the person may see. */
export const LocationQuery = z.object({ locationId: z.string().min(1).max(40).optional() });
