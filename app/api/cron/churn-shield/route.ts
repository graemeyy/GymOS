import { publicRoute, json } from "@/lib/http/route";
import { assertBearer } from "@/lib/http/bearer";
import { env } from "@/lib/env";
import { runDailyJobs } from "@/lib/jobs/daily";

// The daily job (Vercel cron, CRON_SECRET). The path keeps its original name
// so the existing cron schedule keeps working.
export const GET = publicRoute({}, async ({ request, db }) => {
  assertBearer(request, env().CRON_SECRET, "The cron job");
  return json({ ok: true, ...(await runDailyJobs(db)) });
});
