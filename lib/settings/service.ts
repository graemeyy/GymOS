import type { Db } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { logAction } from "@/lib/audit";
import { FEATURE_DEFAULTS } from "./queries";
import type { FeatureSettingsInput } from "./schema";

export function updateFeatureSettings(db: Db, staff: StaffActor, input: FeatureSettingsInput) {
  return db.$transaction(async (tx) => {
    const current = (await tx.gymSettings.findUnique({ where: { id: "singleton" } })) ?? FEATURE_DEFAULTS;
    const settings = await tx.gymSettings.upsert({ where: { id: "singleton" }, update: input, create: { id: "singleton", ...FEATURE_DEFAULTS, ...input } });
    // Only the fields that were sent, old and new.
    const before = Object.fromEntries(Object.keys(input).map((k) => [k, current[k as keyof typeof input]]));
    await logAction(tx, staff, { action: "settings.features_updated", targetType: "GymSettings", details: input, before, after: input });
    return settings;
  });
}
