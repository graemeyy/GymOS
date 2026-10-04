import { z } from "zod";
import { staffRoute, json, zId } from "@/lib/http/route";
import { changePlan } from "@/lib/membership/service";

export const POST = staffRoute({ permission: "members.edit", body: z.object({ planId: zId }) }, async ({ params, body, db, staff }) => {
  return json(await changePlan(db, staff, params.id, body.planId));
});
