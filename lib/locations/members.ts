import type { Db, Tx } from "@/lib/db";
import { planAllowsLocation } from "./access";

// Whether a member's plan lets them in at a location (D-126), from the
// database. No plan means no location.
export async function memberMayUseLocation(db: Db | Tx, memberId: string, locationId: string): Promise<boolean> {
  const m = await db.member.findUnique({
    where: { id: memberId },
    select: { homeLocationId: true, membershipPlan: { select: { locationAccess: true, locations: { select: { locationId: true } } } } },
  });
  if (!m) return false;
  const plan = m.membershipPlan ? { locationAccess: m.membershipPlan.locationAccess, locationIds: m.membershipPlan.locations.map((l) => l.locationId) } : null;
  return planAllowsLocation(plan, m.homeLocationId, locationId);
}

/** The open locations a member's plan covers, for their timetable. */
export async function locationsForMember(db: Db | Tx, memberId: string): Promise<string[]> {
  const [m, locations] = await Promise.all([
    db.member.findUnique({ where: { id: memberId }, select: { homeLocationId: true, membershipPlan: { select: { locationAccess: true, locations: { select: { locationId: true } } } } } }),
    db.location.findMany({ where: { archivedAt: null }, select: { id: true } }),
  ]);
  if (!m) return [];
  const plan = m.membershipPlan ? { locationAccess: m.membershipPlan.locationAccess, locationIds: m.membershipPlan.locations.map((l) => l.locationId) } : null;
  // Without a plan, the timetable shows their home location.
  if (!plan) return [m.homeLocationId];
  return locations.map((l) => l.id).filter((id) => planAllowsLocation(plan, m.homeLocationId, id));
}

export async function assertOpenLocation(db: Db | Tx, locationId: string) {
  const location = await db.location.findUnique({ where: { id: locationId }, select: { id: true, name: true, archivedAt: true } });
  return location && !location.archivedAt ? location : null;
}
