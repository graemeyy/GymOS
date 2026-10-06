import { staffRoute, json } from "@/lib/http/route";
import { setLocationArchived, updateLocation } from "@/lib/locations/service";
import { LocationArchiveBody, LocationBody } from "@/lib/locations/schema";

export const PUT = staffRoute({ permission: "settings.edit", body: LocationBody }, async ({ db, staff, body, params }) => json(await updateLocation(db, staff, params.id, body)));

export const PATCH = staffRoute({ permission: "settings.edit", body: LocationArchiveBody }, async ({ db, staff, body, params }) => json(await setLocationArchived(db, staff, params.id, body.archived)));
