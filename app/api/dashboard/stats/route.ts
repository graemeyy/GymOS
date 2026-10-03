import { staffRoute, json } from "@/lib/http/route";
import { can } from "@/lib/auth/permissions";
import { hideRevenueFromFrontDesk } from "@/lib/auth/session";
import { monthlyEquivalentCents } from "@/lib/money";
import { startOfTodayIn } from "@/lib/dates";
import { gym } from "@/lib/config";

export const GET = staffRoute({ permission: "dashboard:view" }, async ({ db, staff }) => {
  const startOfDay = startOfTodayIn(gym.business.timezone);
  const [active, equipmentAlerts, atRisk, checkInsToday, pastDue] = await Promise.all([
    db.member.findMany({ where: { status: "ACTIVE", archivedAt: null }, select: { membershipPlan: { select: { priceCents: true, interval: true } } } }),
    db.equipment.count({ where: { status: { in: ["WARNING", "OFFLINE"] } } }),
    db.member.count({ where: { status: "ACTIVE", archivedAt: null, retentionScore: { lt: 40 } } }),
    db.checkIn.count({ where: { timestamp: { gte: startOfDay } } }),
    db.member.count({ where: { status: "PAST_DUE", archivedAt: null } }),
  ]);
  const showRevenue = can(staff.role, "revenue:view", { hideRevenueFromFrontDesk: await hideRevenueFromFrontDesk(db) });
  // Estimated from each active member's current plan price, as a monthly figure.
  const mrrCents = active.reduce(
    (sum, m) => sum + (m.membershipPlan ? monthlyEquivalentCents(m.membershipPlan.priceCents, m.membershipPlan.interval) : 0),
    0
  );
  return json({
    activeMembers: active.length,
    checkInsToday,
    pastDue,
    atRisk,
    equipmentAlerts,
    mrrCents: showRevenue ? mrrCents : null,
  });
});
