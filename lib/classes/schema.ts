import { z } from "zod";
import { zId, zName } from "@/lib/http/route";
import { MAIN_LOCATION_ID } from "@/lib/locations/constants";

const zLocation = z.string().min(1).max(40);

export const ClassListQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  mine: z.enum(["1", "0"]).default("0"),
  locationId: zLocation.optional(),
});

export const MemberTimetableQuery = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), locationId: zLocation.optional() });

export const ClassBody = z.object({
  name: zName,
  trainerId: zId.nullable().optional(),
  startTime: z.coerce.date(),
  durationMinutes: z.number().int().min(10).max(240).default(45),
  capacity: z.number().int().min(1).max(500).default(20),
  locationId: zLocation.default(MAIN_LOCATION_ID),
});

export const BookBody = z.object({ memberId: zId, casual: z.boolean().default(false) });

export const AttendanceBody = z.object({ memberId: zId, status: z.enum(["BOOKED", "ATTENDED", "NO_SHOW"]) });

// The member a staff action is for: the body when adding, the query string when removing.
export const MemberRef = z.object({ memberId: zId });

export const TemplateBody = z.object({
  name: zName,
  trainerId: zId.nullable().optional(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
  durationMinutes: z.number().int().min(10).max(240),
  capacity: z.number().int().min(1).max(500),
  active: z.boolean().default(true),
  locationId: zLocation.default(MAIN_LOCATION_ID),
});

export const TemplateListQuery = z.object({ locationId: zLocation.optional() });

export const GenerateBody = z.object({ weeks: z.number().int().min(1).max(8).default(2) });

export type ClassInput = z.infer<typeof ClassBody>;
export type AttendanceInput = z.infer<typeof AttendanceBody>;
export type TemplateInput = z.infer<typeof TemplateBody>;
