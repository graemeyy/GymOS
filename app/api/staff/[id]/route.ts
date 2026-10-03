import { z } from "zod";
import { staffRoute, json, zName, zPassword } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { STAFF_ROLES } from "@/lib/auth/permissions";
import type { Tx } from "@/lib/db";

async function otherOwners(tx: Tx, excludeId: string) {
  return tx.staff.count({ where: { role: "OWNER", id: { not: excludeId } } });
}

const Body = z
  .object({ name: zName.optional(), role: z.enum(STAFF_ROLES).optional(), password: zPassword.optional() })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

// A role change or password reset bumps sessionVersion, which signs that
// person out everywhere on their next request.
export const PUT = staffRoute({ permission: "staff:manage", body: Body }, async ({ params, body, db, staff }) => {
  const passwordHash = body.password ? await hashPassword(body.password) : undefined;
  const updated = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424243)`;
    const existing = await tx.staff.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("not_found", "Staff account not found.");
    if (existing.role === "OWNER" && body.role && body.role !== "OWNER" && (await otherOwners(tx, existing.id)) === 0) {
      throw new ApiError("conflict", "There must be at least one owner account.");
    }
    const revoke = (body.role && body.role !== existing.role) || Boolean(passwordHash);
    return tx.staff.update({
      where: { id: params.id },
      data: { name: body.name, role: body.role, passwordHash, ...(revoke ? { sessionVersion: { increment: 1 } } : {}) },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  });
  await logAction(db, staff, {
    action: "staff.updated",
    targetType: "Staff",
    targetId: updated.id,
    details: { name: body.name ?? null, role: body.role ?? null, passwordReset: Boolean(body.password) },
  });
  return json(updated);
});

export const DELETE = staffRoute({ permission: "staff:manage" }, async ({ params, db, staff }) => {
  if (staff.id === params.id) throw new ApiError("conflict", "You can't remove your own account.");
  const existing = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424243)`;
    const row = await tx.staff.findUnique({ where: { id: params.id } });
    if (!row) throw new ApiError("not_found", "Staff account not found.");
    if (row.role === "OWNER" && (await otherOwners(tx, row.id)) === 0) throw new ApiError("conflict", "There must be at least one owner account.");
    await tx.staff.delete({ where: { id: params.id } });
    return row;
  });
  await logAction(db, staff, { action: "staff.deleted", targetType: "Staff", targetId: params.id, details: { name: existing.name, email: existing.email, role: existing.role } });
  return json({ ok: true });
});
