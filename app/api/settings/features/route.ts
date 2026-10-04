import { z } from "zod";
import { staffRoute, json } from "@/lib/http/route";
import { logAction } from "@/lib/audit";

const DEFAULTS = { requireKeycardForEntry: false, hideRevenueFromFrontDesk: false };

export const GET = staffRoute({ permission: "dashboard:view" }, async ({ db }) => {
  const settings = await db.gymSettings.findUnique({ where: { id: "singleton" } });
  return json({ ...DEFAULTS, ...(settings ?? {}) });
});

// Each switch sends only its own field, so two quick toggles can't undo each
// other with a stale copy of the whole object (R-51).
const Body = z
  .object({ requireKeycardForEntry: z.boolean(), hideRevenueFromFrontDesk: z.boolean() })
  .partial()
  .refine((b) => Object.keys(b).length > 0, "Send at least one setting.");

export const PUT = staffRoute({ permission: "settings:manage", body: Body }, async ({ body, db, staff }) => {
  const settings = await db.gymSettings.upsert({ where: { id: "singleton" }, update: body, create: { id: "singleton", ...DEFAULTS, ...body } });
  await logAction(db, staff, { action: "settings.features_updated", targetType: "GymSettings", details: body });
  return json(settings);
});
