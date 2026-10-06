import { staffRoute, json } from "@/lib/http/route";
import { canSeeRevenue } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/dashboard/queries";
import { LocationQuery } from "@/lib/locations/schema";
import { reportLocations } from "@/lib/locations/scope";

// One location's figures, or the combined figures for every location the
// person can see (D-129).
export const GET = staffRoute({ permission: null, query: LocationQuery }, async ({ db, staff, query }) =>
  json(await getDashboardStats(db, canSeeRevenue(staff), new Date(), reportLocations(staff, query.locationId)))
);
