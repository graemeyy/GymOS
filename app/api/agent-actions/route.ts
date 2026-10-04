import { SEE_STOCK_AND_EQUIPMENT } from "@/lib/auth/permissions";
import { staffRoute, json } from "@/lib/http/route";
import { ApprovalDecisionBody } from "@/lib/equipment/schema";
import { listMaintenanceApprovals } from "@/lib/equipment/queries";
import { decideApproval } from "@/lib/equipment/service";

export const GET = staffRoute({ permission: SEE_STOCK_AND_EQUIPMENT }, async ({ db }) => json(await listMaintenanceApprovals(db)));

export const PATCH = staffRoute({ permission: "products.edit", body: ApprovalDecisionBody }, async ({ body, db, staff }) => json(await decideApproval(db, staff, body)));
