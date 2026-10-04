import { staffRoute, json } from "@/lib/http/route";
import { AuditQuery } from "@/lib/audit-log/schema";
import { listAuditLog } from "@/lib/audit-log/queries";

export const GET = staffRoute({ permission: "audit.view", query: AuditQuery }, async ({ query, db }) => json(await listAuditLog(db, query)));
