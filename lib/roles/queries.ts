import type { Db, Tx } from "@/lib/db";
import { effectivePermissions } from "@/lib/auth/permissions";

const ORDER = ["OWNER", "ADMIN", "MANAGER", "STAFF", "TRAINER"];

// Presets first in a fixed order, then custom roles by name.
export async function listRoles(db: Db) {
  const rows = await db.role.findMany({ include: { _count: { select: { staff: { where: { deactivatedAt: null } } } } } });
  return rows
    .map((r) => ({ id: r.id, name: r.name, description: r.description, preset: r.preset, isOwner: r.isOwner, permissions: effectivePermissions(r), staffCount: r._count.staff }))
    .sort((a, b) => {
      const pa = a.preset ? ORDER.indexOf(a.preset) : ORDER.length;
      const pb = b.preset ? ORDER.indexOf(b.preset) : ORDER.length;
      return pa - pb || a.name.localeCompare(b.name);
    });
}

export function getRole(db: Db | Tx, id: string) {
  return db.role.findUnique({ where: { id } });
}

export function getPresetRole(db: Db | Tx, preset: string) {
  return db.role.findUnique({ where: { preset } });
}
