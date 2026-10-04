import { z } from "zod";

// Each switch sends only its own field, so two quick toggles can't undo each
// other with a stale copy of the whole object (R-51).
export const FeatureSettingsBody = z
  .object({ requireKeycardForEntry: z.boolean(), hideRevenueFromFrontDesk: z.boolean() })
  .partial()
  .refine((b) => Object.keys(b).length > 0, "Send at least one setting.");

export type FeatureSettingsInput = z.infer<typeof FeatureSettingsBody>;
