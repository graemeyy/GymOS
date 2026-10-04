import { staffRoute, json } from "@/lib/http/route";
import { ApprovalDecisionBody } from "@/lib/equipment/schema";
import { listMaintenanceApprovals } from "@/lib/equipment/queries";
import { decideApproval } from "@/lib/equipment/service";

export const GET = staffRoute({ permission: "equipment:read" }, async ({ db }) => json(await listMaintenanceApprovals(db)));

export const PATCH = staffRoute({ permission: "equipment:manage", body: ApprovalDecisionBody }, async ({ body, db, staff }) => json(await decideApproval(db, staff, body)));
