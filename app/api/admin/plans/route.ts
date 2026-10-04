import { staffRoute, json } from "@/lib/http/route";
import { canSeeRevenue } from "@/lib/auth/session";
import { CreatePlanBody } from "@/lib/plans/schema";
import { listPlansWithMemberCounts } from "@/lib/plans/queries";
import { createPlan } from "@/lib/plans/service";

export const GET = staffRoute({ permission: "members:read" }, async ({ db, staff }) => json(await listPlansWithMemberCounts(db, await canSeeRevenue(staff, db))));

export const POST = staffRoute({ permission: "plans:manage", body: CreatePlanBody }, async ({ body, db, staff }) => json(await createPlan(db, staff, body), 201));
