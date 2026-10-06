import type { LocationAccessName } from "./constants";

// Whether a member's plan lets them in at a location (D-126). No plan means
// no locations; the check-in rules then refuse them for that reason first.
export interface PlanAccess {
  locationAccess: LocationAccessName;
  locationIds: readonly string[];
}

export function planAllowsLocation(plan: PlanAccess | null, homeLocationId: string, locationId: string): boolean {
  if (!plan) return false;
  if (plan.locationAccess === "ALL") return true;
  if (plan.locationAccess === "HOME") return homeLocationId === locationId;
  return plan.locationIds.includes(locationId);
}

/** The locations a plan covers, out of all of them, for the member app. */
export function locationsForPlan(plan: PlanAccess | null, homeLocationId: string, all: readonly string[]): string[] {
  return all.filter((id) => planAllowsLocation(plan, homeLocationId, id));
}
