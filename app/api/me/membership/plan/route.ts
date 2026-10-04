import { z } from "zod";
import { memberRoute, json, zId } from "@/lib/http/route";
import { changePlan } from "@/lib/membership/service";

// Upgrades and downgrades follow the owner's timing and proration rules.
export const POST = memberRoute({ body: z.object({ planId: zId }) }, async ({ body, db, member }) => {
  return json(await changePlan(db, member, member.id, body.planId));
});
