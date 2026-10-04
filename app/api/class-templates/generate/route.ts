import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { gym } from "@/lib/config";
import { logAction } from "@/lib/audit";
import { generateClasses } from "@/lib/classes/timetable";

export const POST = staffRoute({ permission: "classes:manage", body: z.object({ weeks: z.number().int().min(1).max(8).default(2) }) }, async ({ body, db, staff }) => {
  const result = await generateClasses(db, gym.business.timezone, body.weeks);
  await logAction(db, staff, { action: "timetable.generated", targetType: "Class", details: { weeks: body.weeks, created: result.created } });
  return json(result);
});
