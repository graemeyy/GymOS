import { ApiError } from "@/lib/http/errors";
import { MAIN_LOCATION_ID } from "./constants";

// Staff can be limited to some locations (D-128). `locationIds` is null for
// someone whose role applies everywhere (owners always do).
export interface LocationScope {
  isOwner: boolean;
  locationIds: readonly string[] | null;
}

export function canUseLocation(staff: LocationScope, locationId: string): boolean {
  return staff.isOwner || staff.locationIds === null || staff.locationIds.includes(locationId);
}

export function assertLocation(staff: LocationScope, locationId: string): void {
  if (!canUseLocation(staff, locationId)) throw new ApiError("forbidden", "Your role doesn't cover that location.");
}

/** Whether this person sees every location's figures (the combined report). */
export function seesAllLocations(staff: LocationScope): boolean {
  return staff.isOwner || staff.locationIds === null;
}

// A Prisma filter on a location column: the one asked for (if allowed), or
// every location the person may see.
export function locationWhere(staff: LocationScope, requested: string | null | undefined, column = "locationId"): Record<string, unknown> {
  if (requested) {
    assertLocation(staff, requested);
    return { [column]: requested };
  }
  return seesAllLocations(staff) ? {} : { [column]: { in: [...(staff.locationIds ?? [])] } };
}

/** The locations to report on: the one asked for, or every location the person can see (null for all). */
export function reportLocations(staff: LocationScope, requested: string | null | undefined): string[] | null {
  if (requested) {
    assertLocation(staff, requested);
    return [requested];
  }
  return seesAllLocations(staff) ? null : [...(staff.locationIds ?? [])];
}

// Where a new row goes when the request doesn't say: the person's only
// location if their role covers one, else the main location. Someone who
// covers several has to choose.
export function defaultLocationFor(staff: LocationScope, requested: string | null | undefined, field = "locationId"): string {
  if (requested) {
    assertLocation(staff, requested);
    return requested;
  }
  if (seesAllLocations(staff)) return MAIN_LOCATION_ID;
  const ids = staff.locationIds ?? [];
  if (ids.length === 1) return ids[0];
  throw new ApiError("validation_failed", "Your role covers more than one location. Choose one.", { [field]: "Choose a location" });
}
