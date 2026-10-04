import { z } from "zod";
import { zId, zName } from "@/lib/http/route";

export const TemplateBody = z.object({
  name: zName,
  trainerId: zId.nullable().optional(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
  durationMinutes: z.number().int().min(10).max(240),
  capacity: z.number().int().min(1).max(500),
  active: z.boolean().default(true),
});
