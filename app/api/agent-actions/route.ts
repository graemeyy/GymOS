import { z } from "zod";
import { staffRoute, json, zId } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";

export const GET = staffRoute({ permission: "equipment:read" }, async ({ db }) => {
  return json(await db.agentAction.findMany({ where: { category: "MAINTENANCE" }, orderBy: { createdAt: "desc" }, take: 100 }));
});

const Body = z.object({ id: zId, status: z.enum(["APPROVED", "REJECTED"]) });

export const PATCH = staffRoute({ permission: "equipment:manage", body: Body }, async ({ body, db, staff }) => {
  const result = await db.agentAction.updateMany({ where: { id: body.id, status: "PENDING" }, data: { status: body.status } });
  if (result.count === 0) throw new ApiError("conflict", "That request has already been decided or doesn't exist.");
  const updated = await db.agentAction.findUniqueOrThrow({ where: { id: body.id } });
  await logAction(db, staff, { action: "approval.decided", targetType: "AgentAction", targetId: body.id, details: { title: updated.title, status: body.status } });
  return json(updated);
});
