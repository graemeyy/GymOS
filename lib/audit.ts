import type { PrismaClient, Prisma } from "@prisma/client";
import type { SessionPayload } from "@/lib/session";

export async function logAction(
  prisma: PrismaClient,
  session: SessionPayload | null,
  data: {
    action: string;
    targetType: string;
    targetId?: string | null;
    details?: Prisma.InputJsonValue;
  }
) {
  await prisma.auditLog.create({
    data: {
      staffId: session?.staffId ?? null,
      staffName: session?.name ?? "Kiosk",
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId ?? null,
      details: data.details,
    },
  });
}
