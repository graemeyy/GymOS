import type { Db, Tx } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { MAIN_LOCATION_ID } from "./constants";
import { locationSelect } from "./queries";
import type { LocationInput } from "./schema";

async function assertUnique(db: Db | Tx, input: LocationInput, exceptId?: string) {
  const clash = await db.location.findFirst({ where: { OR: [{ name: input.name }, { code: input.code }], ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { name: true, code: true } });
  if (clash) {
    throw new ApiError("conflict", "Another location already uses that name or code.", clash.name === input.name ? { name: "Already in use" } : { code: "Already in use" });
  }
}

export function createLocation(db: Db, staff: StaffActor, input: LocationInput) {
  return db.$transaction(async (tx) => {
    await assertUnique(tx, input);
    const created = await tx.location.create({ data: input, select: locationSelect });
    await logAction(tx, staff, { action: "location.created", targetType: "Location", targetId: created.id, after: { name: created.name, code: created.code } });
    return created;
  });
}

export function updateLocation(db: Db, staff: StaffActor, id: string, input: LocationInput) {
  return db.$transaction(async (tx) => {
    const before = await tx.location.findUnique({ where: { id }, select: locationSelect });
    if (!before) throw new ApiError("not_found", "Location not found.");
    await assertUnique(tx, input, id);
    const after = await tx.location.update({ where: { id }, data: input, select: locationSelect });
    const changed = (Object.keys(input) as (keyof LocationInput)[]).filter((k) => before[k] !== after[k]);
    if (changed.length) {
      await logAction(tx, staff, {
        action: "location.updated",
        targetType: "Location",
        targetId: id,
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, after[k]])),
      });
    }
    return after;
  });
}

// Archiving hides a location from pickers and timetables; its history stays.
// The main location can't be archived, because new rows default to it.
export function setLocationArchived(db: Db, staff: StaffActor, id: string, archived: boolean) {
  if (archived && id === MAIN_LOCATION_ID) throw new ApiError("conflict", "The main location can't be archived. Rename it instead if that site has closed.");
  return db.$transaction(async (tx) => {
    const location = await tx.location.findUnique({ where: { id }, select: { id: true, name: true, archivedAt: true } });
    if (!location) throw new ApiError("not_found", "Location not found.");
    if (archived) {
      const upcoming = await tx.class.count({ where: { locationId: id, startTime: { gt: new Date() }, cancelledAt: null } });
      if (upcoming > 0) throw new ApiError("conflict", `${location.name} has ${upcoming} upcoming class(es). Cancel or move them first.`);
      const homes = await tx.member.count({ where: { homeLocationId: id, archivedAt: null } });
      if (homes > 0) throw new ApiError("conflict", `${homes} member(s) have ${location.name} as their home location. Move them first.`);
    }
    const updated = await tx.location.update({ where: { id }, data: { archivedAt: archived ? (location.archivedAt ?? new Date()) : null }, select: locationSelect });
    await logAction(tx, staff, { action: archived ? "location.archived" : "location.restored", targetType: "Location", targetId: id, details: { name: location.name } });
    return updated;
  });
}
