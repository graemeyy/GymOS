import type { Db } from "@/lib/db";

// Never the password hash, invite token or session version.
export const staffSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  deactivatedAt: true,
  inviteExpiresAt: true,
  passwordHash: false,
  assignedRole: { select: { id: true, name: true, isOwner: true } },
  locations: { select: { locationId: true } },
} as const;

type StaffRow = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  deactivatedAt: Date | null;
  inviteExpiresAt: Date | null;
  assignedRole: { id: string; name: string; isOwner: boolean } | null;
  locations: { locationId: string }[];
};

// An invited person who hasn't set a password yet shows as "invited".
export function toStaffView(row: StaffRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    role: row.assignedRole,
    status: row.deactivatedAt ? ("deactivated" as const) : row.inviteExpiresAt ? ("invited" as const) : ("active" as const),
    inviteExpiresAt: row.inviteExpiresAt,
    // Empty means every location (D-128).
    locationIds: row.locations.map((l) => l.locationId),
  };
}

export async function listStaff(db: Db) {
  const rows = await db.staff.findMany({ orderBy: { createdAt: "asc" }, select: staffSelect });
  return rows.map(toStaffView);
}

// Names and role names only, for trainer and roster pickers. Any active staff
// member may see it.
export async function listStaffDirectory(db: Db) {
  const rows = await db.staff.findMany({ where: { deactivatedAt: null, inviteExpiresAt: null, roleId: { not: null } }, orderBy: { name: "asc" }, select: { id: true, name: true, assignedRole: { select: { name: true } } } });
  return rows.map((r) => ({ id: r.id, name: r.name, roleName: r.assignedRole?.name ?? "" }));
}

// A new installation has no staff accounts until first-run setup.
export async function isSetupNeeded(db: Db) {
  return (await db.staff.count()) === 0;
}
