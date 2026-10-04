import { staffRoute, json } from "@/lib/http/route";
import { canSeeRevenue } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/dashboard/queries";

export const GET = staffRoute({ permission: null }, async ({ db, staff }) => json(await getDashboardStats(db, canSeeRevenue(staff))));
