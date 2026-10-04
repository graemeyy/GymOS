import type { Role, StaffRole } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { effectivePermissions, PERMISSION_INFO, type Permission } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import type { CreateRoleInput, UpdateRoleInput } from "./schema";

// The safeguard behind every role and staff change: nobody can grant a
// permission they don't hold themselves. Owners hold everything.
export function assertCanGrant(actor: StaffActor, permissions: readonly Permission[]) {
  if (actor.isOwner) return;
  const missing = permissions.filter((p) => !actor.permissions.includes(p));
  if (missing.length) {
    throw new ApiError("forbidden", `You can't give permissions you don't have yourself: ${missing.map((p) => PERMISSION_INFO[p].label).join(", ")}.`);
  }
}

// Someone may only change a role, or a person's role, that's no more powerful
// than their own; an owner role, only an owner.
export function assertNotMorePowerful(actor: StaffActor, role: Pick<Role, "isOwner" | "permissions">, what: string) {
  if (actor.isOwner) return;
  if (role.isOwner) throw new ApiError("forbidden", `Only an owner can change ${what}.`);
  assertCanGrant(actor, effectivePermissions(role));
}

// The old fixed role closest to a role without giving more access, kept in
// Staff.role so the migration can be rolled back (D-098).
export function legacyRoleFor(role: Pick<Role, "isOwner" | "preset">): StaffRole {
  if (role.isOwner) return "OWNER";
  if (role.preset === "ADMIN" || role.preset === "MANAGER") return "MANAGER";
  if (role.preset === "TRAINER") return "TRAINER";
  return "FRONT_DESK";
}

const snapshot = (r: Pick<Role, "name" | "description" | "permissions">) => ({ name: r.name, description: r.description, permissions: [...r.permissions].sort() });

export function createRole(db: Db, actor: StaffActor, input: CreateRoleInput) {
  assertCanGrant(actor, input.permissions);
  return db.$transaction(async (tx) => {
    if (await tx.role.findUnique({ where: { name: input.name } })) throw new ApiError("conflict", "A role with that name already exists.", { name: "Already in use" });
    const role = await tx.role.create({ data: { name: input.name, description: input.description ?? null, permissions: input.permissions } });
    await logAction(tx, actor, { action: "role.created", targetType: "Role", targetId: role.id, details: { name: role.name }, after: snapshot(role) });
    return role;
  });
}

// The Owner role always grants everything; only its name and description
// change, and only an owner can change them.
export function updateRole(db: Db, actor: StaffActor, id: string, input: UpdateRoleInput) {
  return db.$transaction(async (tx) => {
    const before = await lockRole(tx, id);
    assertNotMorePowerful(actor, before, `the ${before.name} role`);
    if (before.isOwner && input.permissions) throw new ApiError("conflict", "The Owner role always has every permission.");
    if (input.permissions) assertCanGrant(actor, input.permissions);
    if (input.name && input.name !== before.name && (await tx.role.findUnique({ where: { name: input.name } }))) {
      throw new ApiError("conflict", "A role with that name already exists.", { name: "Already in use" });
    }
    const role = await tx.role.update({
      where: { id },
      data: { name: input.name, description: input.description === undefined ? undefined : input.description, permissions: input.permissions },
    });
    await logAction(tx, actor, { action: "role.updated", targetType: "Role", targetId: role.id, details: { name: role.name }, before: snapshot(before), after: snapshot(role) });
    return role;
  });
}

// Presets can be edited but not deleted; a custom role only once nobody has it.
export function deleteRole(db: Db, actor: StaffActor, id: string) {
  return db.$transaction(async (tx) => {
    const role = await lockRole(tx, id);
    if (role.preset) throw new ApiError("conflict", "Preset roles can be edited but not deleted.");
    assertNotMorePowerful(actor, role, `the ${role.name} role`);
    if ((await tx.staff.count({ where: { roleId: id } })) > 0) throw new ApiError("conflict", "Move everyone off this role before deleting it.");
    await tx.role.delete({ where: { id } });
    await logAction(tx, actor, { action: "role.deleted", targetType: "Role", targetId: id, details: { name: role.name }, before: snapshot(role) });
  });
}

async function lockRole(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Role" WHERE "id" = ${id} FOR UPDATE`;
  if (!rows[0]) throw new ApiError("not_found", "Role not found.");
  return tx.role.findUniqueOrThrow({ where: { id } });
}
