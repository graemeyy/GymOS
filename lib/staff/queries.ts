import type { Db } from "@/lib/db";

// Never the password hash or session version.
export const staffSelect = { id: true, name: true, email: true, role: true, createdAt: true } as const;

export function listStaff(db: Db) {
  return db.staff.findMany({ orderBy: { createdAt: "asc" }, select: staffSelect });
}

// A new installation has no staff accounts until first-run setup.
export async function isSetupNeeded(db: Db) {
  return (await db.staff.count()) === 0;
}
