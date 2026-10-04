import { staffRoute, json } from "@/lib/http/route";
import { FeatureSettingsBody } from "@/lib/settings/schema";
import { getFeatureSettings } from "@/lib/settings/queries";
import { updateFeatureSettings } from "@/lib/settings/service";

export const GET = staffRoute({ permission: null }, async ({ db }) => json(await getFeatureSettings(db)));

export const PUT = staffRoute({ permission: "settings.edit", body: FeatureSettingsBody }, async ({ body, db, staff }) => json(await updateFeatureSettings(db, staff, body)));
