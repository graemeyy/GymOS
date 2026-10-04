import { memberRoute, json } from "@/lib/http/route";

export const GET = memberRoute({}, async ({ db, member }) => {
  const now = new Date();
  const [bookings, waitlist] = await Promise.all([
    db.classBooking.findMany({
      where: { memberId: member.id, class: { startTime: { gte: now } } },
      orderBy: { class: { startTime: "asc" } },
      select: { id: true, status: true, class: { select: { id: true, name: true, startTime: true, durationMinutes: true, instructor: true } } },
    }),
    db.classWaitlist.findMany({
      where: { memberId: member.id, class: { startTime: { gte: now } } },
      orderBy: { class: { startTime: "asc" } },
      select: { id: true, class: { select: { id: true, name: true, startTime: true } } },
    }),
  ]);
  return json({ bookings, waitlist });
});
