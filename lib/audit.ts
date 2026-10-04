import type { Prisma } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";
import type { MemberActor, StaffActor } from "@/lib/auth/session";

export type Actor = StaffActor | MemberActor | { kind: "system"; name: string };

// Records who did what. Staff actions link to the staff row; member and
// system actions keep the name in staffName and put the member ID in details.
export async function logAction(
  db: Db | Tx,
  actor: Actor,
  data: { action: string; targetType: string; targetId?: string | null; details?: Prisma.InputJsonValue }
) {
  const details: Prisma.InputJsonValue | undefined =
    actor.kind === "member"
      ? { ...(isObject(data.details) ? data.details : {}), actorMemberId: actor.id }
      : data.details;
  await db.auditLog.create({
    data: {
      staffId: actor.kind === "staff" ? actor.id : null,
      staffName: actor.kind === "member" ? `Member: ${actor.name}` : actor.name,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId ?? null,
      details,
    },
  });
}

function isObject(value: unknown): value is Record<string, Prisma.InputJsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
