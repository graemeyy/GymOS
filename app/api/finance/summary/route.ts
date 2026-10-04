import { staffRoute, json } from "@/lib/http/route";
import { gym } from "@/lib/config";
import { financeSummary } from "@/lib/finance/reports";
import { standardPeriods } from "@/lib/finance/periods";
import { RangeQuery, resolveRange } from "@/lib/finance/range";

export const GET = staffRoute({ permission: "finance:view", query: RangeQuery }, async ({ query, db }) => {
  const range = resolveRange(query);
  const summary = await financeSummary(db, range.from, range.to);
  return json({ ...summary, label: range.label, periods: standardPeriods(gym.business.timezone).map(({ key, label }) => ({ key, label })) });
});
