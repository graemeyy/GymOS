import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { gym } from "@/lib/config";
import { DAY_MS } from "@/lib/time";

const memberSelect = { select: { id: true, name: true, email: true } } as const;

// Defaults to 24 hours ago (so finished classes can still have attendance
// marked) through 14 days ahead.
export function listClasses(db: Db, filter: { from?: Date; to?: Date; trainerId?: string }) {
  const from = filter.from ?? new Date(Date.now() - DAY_MS);
  const to = filter.to ?? new Date(Date.now() + 14 * DAY_MS);
  if (to.getTime() - from.getTime() > 62 * DAY_MS) throw new ApiError("validation_failed", "Choose a range of two months or less.");
  return db.class.findMany({
    where: { startTime: { gte: from, lt: to }, cancelledAt: null, ...(filter.trainerId ? { trainerId: filter.trainerId } : {}) },
    orderBy: { startTime: "asc" },
    include: {
      trainer: { select: { id: true, name: true } },
      bookings: { include: { member: memberSelect } },
      waitlist: { orderBy: { createdAt: "asc" }, include: { member: memberSelect } },
    },
  });
}

// The timetable as a member sees it: spots left and their own booking or
// waitlist place. Other members' names are never included.
export async function listClassesForMember(db: Db, memberId: string, range: { from?: Date; to?: Date }) {
  const from = range.from ?? new Date();
  const to = range.to ?? new Date(from.getTime() + 7 * DAY_MS);
  if (to.getTime() - from.getTime() > 31 * DAY_MS) throw new ApiError("validation_failed", "Choose a range of a month or less.");
  const classes = await db.class.findMany({
    where: { startTime: { gte: from, lt: to }, cancelledAt: null },
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
      bookings: { where: { memberId }, select: { id: true } },
      waitlist: { orderBy: { createdAt: "asc" }, select: { memberId: true } },
    },
  });
  const opensUntil = Date.now() + gym.policies.classes.bookingOpensDaysAhead * DAY_MS;
  return classes.map((c) => {
    const position = c.waitlist.findIndex((w) => w.memberId === memberId);
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
  });
}

export async function getUpcomingBookingsForMember(db: Db, memberId: string) {
  const now = new Date();
  const [bookings, waitlist] = await Promise.all([
    db.classBooking.findMany({
      where: { memberId, class: { startTime: { gte: now } } },
      orderBy: { class: { startTime: "asc" } },
      select: { id: true, status: true, class: { select: { id: true, name: true, startTime: true, durationMinutes: true, instructor: true } } },
    }),
    db.classWaitlist.findMany({
      where: { memberId, class: { startTime: { gte: now } } },
      orderBy: { class: { startTime: "asc" } },
      select: { id: true, class: { select: { id: true, name: true, startTime: true } } },
    }),
  ]);
  return { bookings, waitlist };
}

export function listTemplates(db: Db) {
  return db.classTemplate.findMany({ orderBy: [{ weekday: "asc" }, { startTime: "asc" }], include: { trainer: { select: { id: true, name: true } } } });
}
