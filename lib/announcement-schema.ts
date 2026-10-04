import { z } from "zod";
import { zId } from "@/lib/http/route";

export const AnnouncementBody = z
  .object({
    title: z.string().trim().min(3, "Add a title").max(120),
    body: z.string().trim().min(3, "Write the announcement").max(4000),
    audience: z.enum(["ALL_ACTIVE", "PLAN", "STAFF_ONLY"]).default("ALL_ACTIVE"),
    planId: zId.nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .refine((b) => b.audience !== "PLAN" || Boolean(b.planId), { message: "Choose a plan", path: ["planId"] });
