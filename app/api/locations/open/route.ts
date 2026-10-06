import { publicRoute, json } from "@/lib/http/route";
import { listLocations } from "@/lib/locations/queries";

// The open locations, by name and suburb, for sign-up and the shop's pickup
// choice. Nothing here is private: it's what's on the gym's website.
export const GET = publicRoute({}, async ({ db }) => json((await listLocations(db)).map((l) => ({ id: l.id, name: l.name, suburb: l.suburb }))));
