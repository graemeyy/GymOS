import type { Db, Tx } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { logAction, type Actor } from "@/lib/audit";
import { gym } from "@/lib/config";
import { returnClassCredit, useClassCredit } from "@/lib/membership/benefits";
import { sendEmail, signature } from "@/lib/email";

// Locks the class row for the rest of the transaction. Every booking path
// takes this lock first, so two requests for the last spot run one after the
// other instead of both seeing a free place.
async function lockClass(tx: Tx, classId: string) {
  const rows = await tx.$queryRaw<{ id: string; name: string; capacity: number; startTime: Date }[]>`
    SELECT "id", "name", "capacity", "startTime" FROM "Class" WHERE "id" = ${classId} FOR UPDATE`;
  const cls = rows[0];
  if (!cls) throw new ApiError("not_found", "Class not found.");
  return cls;
}

async function assertBookableMember(tx: Tx, memberId: string) {
  const member = await tx.member.findUnique({ where: { id: memberId }, select: { id: true, archivedAt: true } });
  if (!member) throw new ApiError("not_found", "Member not found.");
  if (member.archivedAt) throw new ApiError("conflict", "This member is archived.");
}

// Books a member in and uses a class credit if their plan has a limit.
// `casual` books without a credit (staff only), e.g. a paid casual visit.
export async function bookMember(db: Db, actor: Actor, classId: string, memberId: string, opts: { casual?: boolean } = {}) {
  return db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    await assertBookableMember(tx, memberId);
    if (cls.startTime.getTime() < Date.now() - 60 * 60 * 1000) throw new ApiError("conflict", "This class has already finished.");
    const existing = await tx.classBooking.findUnique({ where: { classId_memberId: { classId, memberId } } });
    if (existing) throw new ApiError("conflict", "Already booked into this class.");
    const booked = await tx.classBooking.count({ where: { classId } });
    if (booked >= cls.capacity) throw new ApiError("conflict", "This class is full. Join the waitlist instead.");
    if (actor.kind === "member") {
      const opensAt = Date.now() + gym.policies.classes.bookingOpensDaysAhead * 86_400_000;
      if (cls.startTime.getTime() > opensAt) throw new ApiError("conflict", `Booking opens ${gym.policies.classes.bookingOpensDaysAhead} days before the class.`);
      const member = await tx.member.findUniqueOrThrow({ where: { id: memberId }, select: { status: true } });
      if (member.status !== "ACTIVE") throw new ApiError("conflict", "Your membership needs to be active to book classes.");
    }
    const usedCredit = await useClassCredit(tx, memberId, classId, { allowOverride: Boolean(opts.casual) && actor.kind === "staff" });
    const booking = await tx.classBooking.create({ data: { classId, memberId, usedCredit } });
    await tx.classWaitlist.deleteMany({ where: { classId, memberId } });
    await logAction(tx, actor, { action: "class.booked", targetType: "Class", targetId: classId, details: { className: cls.name, memberId, usedCredit, casual: Boolean(opts.casual) } });
    return booking;
  });
}

// Cancels a booking. The credit comes back if it's early enough (owner's
// rule); a late cancellation forfeits it when the owner says so. The first
// person on the waitlist who can book is moved in and told by email.
export async function cancelBooking(db: Db, actor: Actor, classId: string, memberId: string) {
  const result = await db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    const booking = await tx.classBooking.findUnique({ where: { classId_memberId: { classId, memberId } } });
    if (!booking) throw new ApiError("not_found", "No booking to cancel.");
    const hoursBefore = (cls.startTime.getTime() - Date.now()) / 3_600_000;
    const policy = gym.policies.classes;
    const late = hoursBefore < policy.cancelWithoutPenaltyHours;
    if (actor.kind === "member" && hoursBefore < 0) throw new ApiError("conflict", "This class has already started.");
    await tx.classBooking.delete({ where: { id: booking.id } });
    const creditReturned = booking.usedCredit && (!late || !policy.lateCancelForfeitsCredit || actor.kind === "staff");
    if (creditReturned) await returnClassCredit(tx, memberId, classId);
    await logAction(tx, actor, { action: "class.booking_cancelled", targetType: "Class", targetId: classId, details: { className: cls.name, memberId, late, creditReturned } });

    let promoted: { memberId: string; email: string; name: string | null; notify: boolean } | null = null;
    if (cls.startTime.getTime() > Date.now()) {
      const queue = await tx.classWaitlist.findMany({ where: { classId }, orderBy: { createdAt: "asc" }, include: { member: { select: { email: true, name: true, status: true, archivedAt: true, notifyWaitlist: true } } } });
      for (const entry of queue) {
        if (entry.member.archivedAt || entry.member.status !== "ACTIVE") continue;
        try {
          await tx.$executeRaw`SAVEPOINT promote`;
          const usedCredit = await useClassCredit(tx, entry.memberId, classId);
          await tx.classBooking.create({ data: { classId, memberId: entry.memberId, usedCredit } });
          await tx.classWaitlist.delete({ where: { id: entry.id } });
          await tx.$executeRaw`RELEASE SAVEPOINT promote`;
          promoted = { memberId: entry.memberId, email: entry.member.email, name: entry.member.name, notify: entry.member.notifyWaitlist };
          await logAction(tx, { kind: "system", name: "Waitlist" }, { action: "class.waitlist_promoted", targetType: "Class", targetId: classId, details: { className: cls.name, memberId: entry.memberId, automatic: true } });
          break;
        } catch (error) {
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT promote`;
          if (!(error instanceof ApiError)) throw error;
          // No credits left: leave them on the list and try the next person.
        }
      }
    }
    return { late, creditReturned, promoted, cls };
  });
  // Members who turned waitlist emails off still get the place; they see it
  // in their bookings.
  if (result.promoted?.notify) {
    const when = new Intl.DateTimeFormat("en-AU", { timeZone: gym.business.timezone, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(result.cls.startTime);
    await sendEmail({
      to: result.promoted.email,
      subject: `You're in: ${result.cls.name}`,
      text: `Hi ${result.promoted.name?.split(" ")[0] ?? "there"},\n\nA spot opened up and you've been moved off the waitlist into ${result.cls.name} on ${when}. If you can't make it, cancel from your bookings so someone else can go.${signature()}`,
    });
  }
  return { late: result.late, creditReturned: result.creditReturned, promotedMemberId: result.promoted?.memberId ?? null };
}

export async function joinWaitlist(db: Db, actor: Actor, classId: string, memberId: string) {
  return db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    await assertBookableMember(tx, memberId);
    const booked = await tx.classBooking.count({ where: { classId } });
    if (booked < cls.capacity) throw new ApiError("conflict", "This class still has spots. Book directly.");
    if (await tx.classBooking.findUnique({ where: { classId_memberId: { classId, memberId } } })) {
      throw new ApiError("conflict", "Already booked into this class.");
    }
    if (await tx.classWaitlist.findUnique({ where: { classId_memberId: { classId, memberId } } })) {
      throw new ApiError("conflict", "Already on the waitlist.");
    }
    const entry = await tx.classWaitlist.create({ data: { classId, memberId } });
    await logAction(tx, actor, { action: "class.waitlisted", targetType: "Class", targetId: classId, details: { className: cls.name, memberId } });
    return entry;
  });
}

export async function leaveWaitlist(db: Db, actor: Actor, classId: string, memberId: string) {
  const deleted = await db.classWaitlist.deleteMany({ where: { classId, memberId } });
  if (deleted.count === 0) throw new ApiError("not_found", "Not on the waitlist.");
  await logAction(db, actor, { action: "class.waitlist_removed", targetType: "Class", targetId: classId, details: { memberId } });
}

export async function promoteFromWaitlist(db: Db, actor: Actor, classId: string, memberId: string) {
  return db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    const booked = await tx.classBooking.count({ where: { classId } });
    if (booked >= cls.capacity) throw new ApiError("conflict", "The class is full. Free up a spot before promoting.");
    const removed = await tx.classWaitlist.deleteMany({ where: { classId, memberId } });
    if (removed.count === 0) throw new ApiError("conflict", "Member isn't on the waitlist.");
    const usedCredit = await useClassCredit(tx, memberId, classId, { allowOverride: actor.kind === "staff" });
    const booking = await tx.classBooking.create({ data: { classId, memberId, usedCredit } });
    await logAction(tx, actor, { action: "class.waitlist_promoted", targetType: "Class", targetId: classId, details: { className: cls.name, memberId, usedCredit } });
    return booking;
  });
}
