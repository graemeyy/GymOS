import type { Db } from "@/lib/db";

export const FEATURE_DEFAULTS = { requireKeycardForEntry: false, hideRevenueFromFrontDesk: false };

export async function getFeatureSettings(db: Db) {
  const settings = await db.gymSettings.findUnique({ where: { id: "singleton" } });
  return { ...FEATURE_DEFAULTS, ...(settings ?? {}) };
}
