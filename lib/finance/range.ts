import { z } from "zod";
import { gym } from "@/lib/config";
import { zonedTimeToUtc } from "@/lib/dates";
import { ApiError } from "@/lib/http/errors";
import { standardPeriods } from "./periods";

export const RangeQuery = z.object({
  period: z.string().max(40).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// A named period ("this-quarter") or explicit dates. `to` is inclusive of the
// whole day, in the gym's timezone.
export function resolveRange(q: z.infer<typeof RangeQuery>) {
  const tz = gym.business.timezone;
  if (q.from && q.to) {
    const from = zonedTimeToUtc(q.from, "00:00", tz);
    const to = new Date(zonedTimeToUtc(q.to, "00:00", tz).getTime() + 86_400_000);
    if (to <= from) throw new ApiError("validation_failed", "The end date must be on or after the start date.", { to: "Too early" });
    if (to.getTime() - from.getTime() > 3 * 366 * 86_400_000) throw new ApiError("validation_failed", "Choose a range of three years or less.", { to: "Too long" });
    return { from, to, label: `${q.from} to ${q.to}` };
  }
  const periods = standardPeriods(tz);
  const p = periods.find((x) => x.key === (q.period ?? "this-month")) ?? periods[0];
  return { from: p.from, to: p.to, label: p.label };
}
