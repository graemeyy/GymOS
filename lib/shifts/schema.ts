import { z } from "zod";
import { zId } from "@/lib/http/route";
import { HOUR_MS } from "@/lib/time";

export const ShiftBody = z
  .object({ staffId: zId, startTime: z.coerce.date(), endTime: z.coerce.date(), notes: z.string().trim().max(500).nullable().optional() })
  .refine((b) => b.endTime > b.startTime, { message: "End time must be after start time", path: ["endTime"] })
  .refine((b) => b.endTime.getTime() - b.startTime.getTime() <= 16 * HOUR_MS, { message: "A shift can't be longer than 16 hours", path: ["endTime"] });

export type ShiftInput = z.infer<typeof ShiftBody>;
