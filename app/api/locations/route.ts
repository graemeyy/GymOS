import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { listLocations } from "@/lib/locations/queries";
import { createLocation } from "@/lib/locations/service";
import { LocationBody } from "@/lib/locations/schema";

const Query = z.object({ archived: z.enum(["include", "exclude"]).default("exclude") });

// Every staff member sees the locations (for pickers and the location
// filter); changing them needs settings.edit (D-125).
export const GET = staffRoute({ permission: null, query: Query }, async ({ db, query }) => json(await listLocations(db, { includeArchived: query.archived === "include" })));

export const POST = staffRoute({ permission: "settings.edit", body: LocationBody }, async ({ db, staff, body }) => json(await createLocation(db, staff, body), 201));
