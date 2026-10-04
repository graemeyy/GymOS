import { staffRoute, json } from "@/lib/http/route";
import { UpdatePlanBody } from "@/lib/plans/schema";
import { updatePlan } from "@/lib/plans/service";

export const PUT = staffRoute({ permission: "plans:manage", body: UpdatePlanBody }, async ({ params, body, db, staff }) => json(await updatePlan(db, staff, params.id, body)));
