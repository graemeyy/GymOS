import { staffRoute, json } from "@/lib/http/route";
import { GenerateBody } from "@/lib/classes/schema";
import { generateTimetable } from "@/lib/classes/service";

export const POST = staffRoute({ permission: "classes.manage", body: GenerateBody }, async ({ body, db, staff }) => {
  return json(await generateTimetable(db, staff, body.weeks));
});
