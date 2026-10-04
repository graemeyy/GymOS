import type { Staff } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { staffSelect } from "./queries";
import type { CreateStaffInput, FirstOwnerInput, UpdateStaffInput } from "./schema";

// Role changes and removals take advisory lock 424243 before counting
// owners, so two owners can't each demote or remove the other at the same
// moment and leave the gym with none.
async function otherOwners(tx: Tx, excludeId: string) {
  return tx.staff.count({ where: { role: "OWNER", id: { not: excludeId } } });
}

// The first staff account, as OWNER. Refused once any account exists; an
// advisory lock serialises two simultaneous first-run requests.
export async function createFirstOwner(db: Db, input: FirstOwnerInput) {
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
    if ((await tx.staff.count()) > 0) throw new ApiError("conflict", "Setup has already been completed.");
    const created = await tx.staff.create({ data: { name: input.name, email: input.email, passwordHash, role: "OWNER" } });
    await logAction(tx, { kind: "staff", id: created.id, name: created.name, role: "OWNER" }, {
      action: "staff.created",
      targetType: "Staff",
      targetId: created.id,
      details: { role: "OWNER", note: "Initial setup" },
    });
    return created;
  });
}

export async function createStaff(db: Db, staff: StaffActor, input: CreateStaffInput) {
  if (await db.staff.findUnique({ where: { email: input.email } })) {
    throw new ApiError("conflict", "A staff account with that email already exists.", { email: "Already in use" });
  }
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const created = await tx.staff.create({ data: { name: input.name, email: input.email, role: input.role, passwordHash }, select: staffSelect });
    await logAction(tx, staff, { action: "staff.created", targetType: "Staff", targetId: created.id, details: { name: input.name, email: input.email, role: input.role } });
    return created;
  });
}

// A role change or password reset bumps sessionVersion, which signs that
// person out everywhere on their next request.
export async function updateStaff(db: Db, staff: StaffActor, id: string, input: UpdateStaffInput) {
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424243)`;
    const existing = await tx.staff.findUnique({ where: { id } });
    if (!existing) throw new ApiError("not_found", "Staff account not found.");
    if (existing.role === "OWNER" && input.role && input.role !== "OWNER" && (await otherOwners(tx, existing.id)) === 0) {
      throw new ApiError("conflict", "There must be at least one owner account.");
    }
    const revoke = (input.role && input.role !== existing.role) || Boolean(passwordHash);
    const updated = await tx.staff.update({
      where: { id },
      data: { name: input.name, role: input.role, passwordHash, ...(revoke ? { sessionVersion: { increment: 1 } } : {}) },
      select: staffSelect,
    });
    await logAction(tx, staff, {
      action: "staff.updated",
      targetType: "Staff",
      targetId: updated.id,
      details: { name: input.name ?? null, role: input.role ?? null, passwordReset: Boolean(input.password) },
    });
    return updated;
  });
}

export async function deleteStaff(db: Db, staff: StaffActor, id: string) {
  if (staff.id === id) throw new ApiError("conflict", "You can't remove your own account.");
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424243)`;
    const row = await tx.staff.findUnique({ where: { id } });
    if (!row) throw new ApiError("not_found", "Staff account not found.");
    if (row.role === "OWNER" && (await otherOwners(tx, row.id)) === 0) throw new ApiError("conflict", "There must be at least one owner account.");
    await tx.staff.delete({ where: { id } });
    await logAction(tx, staff, { action: "staff.deleted", targetType: "Staff", targetId: id, details: { name: row.name, email: row.email, role: row.role } });
  });
}

// Other sessions for the account end; the caller issues this one a fresh
// cookie from the returned session version.
export async function changeOwnPassword(db: Db, staff: StaffActor, currentPassword: string, newPassword: string) {
  const record = await db.staff.findUniqueOrThrow({ where: { id: staff.id } });
  if (!(await verifyPassword(currentPassword, record.passwordHash))) {
    throw new ApiError("validation_failed", "That isn't your current password.", { currentPassword: "Incorrect" });
  }
  const passwordHash = await hashPassword(newPassword);
  return db.$transaction(async (tx) => {
    const updated = await tx.staff.update({ where: { id: staff.id }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    await logAction(tx, staff, { action: "staff.password_changed", targetType: "Staff", targetId: staff.id });
    return updated;
  });
}

export function recordStaffSignIn(db: Db, staff: Pick<Staff, "id" | "name" | "role">) {
  return logAction(db, { kind: "staff", id: staff.id, name: staff.name, role: staff.role }, {
    action: "staff.signed_in",
    targetType: "Staff",
    targetId: staff.id,
  });
}
