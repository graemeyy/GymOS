import type { Db } from "@/lib/db";
import { getBranding } from "@/lib/branding/service";
import { locationsForMember } from "./members";

export const locationSelect = { id: true, name: true, code: true, addressLine1: true, addressLine2: true, suburb: true, state: true, postcode: true, phone: true, sortOrder: true, archivedAt: true } as const;

export function listLocations(db: Db, opts: { includeArchived?: boolean } = {}) {
  return db.location.findMany({
    where: opts.includeArchived ? {} : { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: locationSelect,
  });
}

export function getLocation(db: Db, id: string) {
  return db.location.findUnique({ where: { id }, select: locationSelect });
}

// A door gateway or kiosk names its location by code; an unknown code is
// recorded at the main location rather than refused, so a misconfigured door
// still lets members in by their plan's rules.
export function findLocationByCode(db: Db, code: string) {
  return db.location.findFirst({ where: { OR: [{ code: code.toLowerCase() }, { id: code }], archivedAt: null }, select: { id: true, name: true } });
}

// The open locations a member's plan covers, with names, for the member app.
export async function listMemberLocations(db: Db, memberId: string) {
  const ids = await locationsForMember(db, memberId);
  return db.location.findMany({ where: { id: { in: ids } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
}

/** Location names, A to Z, for report headings. */
export async function locationNames(db: Db, ids: readonly string[]): Promise<string> {
  const rows = await db.location.findMany({ where: { id: { in: [...ids] } }, select: { name: true }, orderBy: { name: "asc" } });
  return rows.map((l) => l.name).join(", ");
}

/** Where to collect a pickup order: its location's address, or the gym's
 * address when the location doesn't have one yet. */
export async function pickupAddress(db: Db, locationId: string) {
  const [location, branding] = await Promise.all([getLocation(db, locationId), getBranding(db)]);
  if (location?.addressLine1) {
    return { name: location.name, line1: location.addressLine1, line2: location.addressLine2, suburb: location.suburb, state: location.state, postcode: location.postcode };
  }
  return { name: location?.name ?? "", ...branding.address };
}
