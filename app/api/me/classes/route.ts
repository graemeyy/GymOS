import { z } from "zod";
import { memberRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { gym } from "@/lib/config";

const Query = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

// The timetable as a member sees it: spots left and their own booking or
// waitlist place. Other members' names are never included.
export const GET = memberRoute({ query: Query }, async ({ query, db, member }) => {
  const from = query.from ?? new Date();
  const to = query.to ?? new Date(from.getTime() + 7 * 86_400_000);
  if (to.getTime() - from.getTime() > 31 * 86_400_000) throw new ApiError("validation_failed", "Choose a range of a month or less.");
  const classes = await db.class.findMany({
    where: { startTime: { gte: from, lt: to } },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      name: true,
      startTime: true,
      durationMinutes: true,
      capacity: true,
      instructor: true,
      trainer: { select: { name: true } },
      _count: { select: { bookings: true } },
      bookings: { where: { memberId: member.id }, select: { id: true } },
      waitlist: { orderBy: { createdAt: "asc" }, select: { memberId: true } },
    },
  });
  const opensUntil = Date.now() + gym.policies.classes.bookingOpensDaysAhead * 86_400_000;
  return json({
    bookingOpensDaysAhead: gym.policies.classes.bookingOpensDaysAhead,
    cancelWithoutPenaltyHours: gym.policies.classes.cancelWithoutPenaltyHours,
    lateCancelForfeitsCredit: gym.policies.classes.lateCancelForfeitsCredit,
    classes: classes.map((c) => {
      const position = c.waitlist.findIndex((w) => w.memberId === member.id);
      return {
        id: c.id,
        name: c.name,
        startTime: c.startTime,
        durationMinutes: c.durationMinutes,
        coach: c.trainer?.name ?? c.instructor ?? null,
        capacity: c.capacity,
        spotsLeft: Math.max(0, c.capacity - c._count.bookings),
        waitlistLength: c.waitlist.length,
        booked: c.bookings.length > 0,
        waitlistPosition: position >= 0 ? position + 1 : null,
        bookingOpen: c.startTime.getTime() <= opensUntil,
      };
    }),
  });
});
