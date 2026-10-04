import type { Db, Tx } from "@/lib/db";
import type { MemberActor, StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction, type Actor } from "@/lib/audit";
import { gym } from "@/lib/config";
import { DAY_MS, MINUTE_MS } from "@/lib/time";
import { returnClassCredit, spendClassCredit } from "@/lib/membership/benefits";
import { sendEmail, signature } from "@/lib/email";
import { generateClasses } from "./timetable";
import type { AttendanceInput, ClassInput, TemplateInput } from "./schema";

interface LockedClass {
  id: string;
  name: string;
  capacity: number;
  startTime: Date;
  durationMinutes: number;
  cancelledAt: Date | null;
}

// Locks the class row for the rest of the transaction. Every booking path
// takes this lock first, so two requests for the last spot run one after the
// other instead of both seeing a free place.
async function lockClass(tx: Tx, classId: string): Promise<LockedClass> {
  const rows = await tx.$queryRaw<LockedClass[]>`
    SELECT "id", "name", "capacity", "startTime", "durationMinutes", "cancelledAt" FROM "Class" WHERE "id" = ${classId} FOR UPDATE`;
  const cls = rows[0];
  if (!cls) throw new ApiError("not_found", "Class not found.");
  return cls;
}

const hasStarted = (cls: LockedClass, now = Date.now()) => cls.startTime.getTime() <= now;
const hasFinished = (cls: LockedClass, now = Date.now()) => cls.startTime.getTime() + cls.durationMinutes * MINUTE_MS <= now;

function assertBookingOpen(cls: LockedClass) {
  const opensUntil = Date.now() + gym.policies.classes.bookingOpensDaysAhead * DAY_MS;
  if (cls.startTime.getTime() > opensUntil) throw new ApiError("conflict", `Booking opens ${gym.policies.classes.bookingOpensDaysAhead} days before the class.`);
}

// Who can be booked in. Members book themselves only while active. Staff
// can't book a member whose membership has ended or not started, except as
// a casual (paid-on-the-day) visit (R-86).
async function assertBookableMember(tx: Tx, actor: Actor, memberId: string, opts: { casual?: boolean } = {}) {
  const member = await tx.member.findUnique({ where: { id: memberId }, select: { id: true, archivedAt: true, status: true } });
  if (!member) throw new ApiError("not_found", "Member not found.");
  if (member.archivedAt) throw new ApiError("conflict", "This member is archived.");
  if (actor.kind === "member") {
    if (member.status !== "ACTIVE") throw new ApiError("conflict", "Your membership needs to be active to book classes.");
  } else if ((member.status === "CANCELED" || member.status === "PENDING") && !opts.casual) {
    throw new ApiError("conflict", "This member doesn't have a current membership. Book them as a casual visit instead.");
  }
}

// Books a member in and spends a class credit if their plan has a limit.
// `casual` books without a credit (staff only), e.g. a paid casual visit.
export async function bookMember(db: Db, actor: Actor, classId: string, memberId: string, opts: { casual?: boolean } = {}) {
  return db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    if (cls.cancelledAt) throw new ApiError("conflict", "This class has been cancelled.");
    if (hasFinished(cls)) throw new ApiError("conflict", "This class has already finished.");
    if (actor.kind === "member") {
      if (hasStarted(cls)) throw new ApiError("conflict", "This class has already started.");
      assertBookingOpen(cls);
    }
    const casual = Boolean(opts.casual) && actor.kind === "staff";
    await assertBookableMember(tx, actor, memberId, { casual });
    const existing = await tx.classBooking.findUnique({ where: { classId_memberId: { classId, memberId } } });
    if (existing) throw new ApiError("conflict", "Already booked into this class.");
    const booked = await tx.classBooking.count({ where: { classId } });
    if (booked >= cls.capacity) throw new ApiError("conflict", "This class is full. Join the waitlist instead.");
    const usedCredit = await spendClassCredit(tx, memberId, cls, { allowOverride: casual });
    const booking = await tx.classBooking.create({ data: { classId, memberId, usedCredit } });
    await tx.classWaitlist.deleteMany({ where: { classId, memberId } });
    await logAction(tx, actor, { action: "class.booked", targetType: "Class", targetId: classId, details: { className: cls.name, memberId, usedCredit, casual } });
    return booking;
  });
}

type Promoted = { memberId: string; email: string; name: string | null; notify: boolean };

// Moves the first person on the waitlist who can book into a free spot.
// Members without credits left stay on the list and the next person is tried.
async function promoteNext(tx: Tx, cls: LockedClass): Promise<Promoted | null> {
  if (hasStarted(cls) || cls.cancelledAt) return null;
  const queue = await tx.classWaitlist.findMany({
    where: { classId: cls.id },
    orderBy: { createdAt: "asc" },
    include: { member: { select: { email: true, name: true, status: true, archivedAt: true, notifyWaitlist: true } } },
  });
  for (const entry of queue) {
    if (entry.member.archivedAt || entry.member.status !== "ACTIVE") continue;
    try {
      await tx.$executeRaw`SAVEPOINT promote`;
      const usedCredit = await spendClassCredit(tx, entry.memberId, cls);
      await tx.classBooking.create({ data: { classId: cls.id, memberId: entry.memberId, usedCredit } });
      await tx.classWaitlist.delete({ where: { id: entry.id } });
      await tx.$executeRaw`RELEASE SAVEPOINT promote`;
      await logAction(tx, { kind: "system", name: "Waitlist" }, { action: "class.waitlist_promoted", targetType: "Class", targetId: cls.id, details: { className: cls.name, memberId: entry.memberId, automatic: true } });
      return { memberId: entry.memberId, email: entry.member.email, name: entry.member.name, notify: entry.member.notifyWaitlist };
    } catch (error) {
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT promote`;
      if (!(error instanceof ApiError)) throw error;
    }
  }
  return null;
}

// Members who turned waitlist emails off still get the place; they see it
// in their bookings.
async function emailPromotion(promoted: Promoted | null, cls: LockedClass) {
  if (!promoted?.notify) return;
  const when = new Intl.DateTimeFormat("en-AU", { timeZone: gym.business.timezone, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(cls.startTime);
  await sendEmail({
    to: promoted.email,
    subject: `You're in: ${cls.name}`,
    text: `Hi ${promoted.name?.split(" ")[0] ?? "there"},\n\nA spot opened up and you've been moved off the waitlist into ${cls.name} on ${when}. If you can't make it, cancel from your bookings so someone else can go.${signature()}`,
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
    const creditReturned = booking.usedCredit && (!late || !policy.lateCancelForfeitsCredit || actor.kind !== "member");
    if (creditReturned) await returnClassCredit(tx, memberId, cls);
    await logAction(tx, actor, { action: "class.booking_cancelled", targetType: "Class", targetId: classId, details: { className: cls.name, memberId, late, creditReturned } });
    const promoted = await promoteNext(tx, cls);
    return { late, creditReturned, promoted, cls };
  });
  await emailPromotion(result.promoted, result.cls);
  return { late: result.late, creditReturned: result.creditReturned, promotedMemberId: result.promoted?.memberId ?? null };
}

// Cancels a whole class: bookings are removed with their credits returned,
// the waitlist is cleared, and the row stays (marked cancelled) so the daily
// timetable job doesn't recreate it (R-05).
export async function cancelClass(db: Db, actor: Actor, classId: string) {
  return db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    if (cls.cancelledAt) throw new ApiError("conflict", "This class is already cancelled.");
    const bookings = await tx.classBooking.findMany({ where: { classId }, select: { memberId: true, usedCredit: true } });
    for (const b of bookings) {
      if (b.usedCredit) await returnClassCredit(tx, b.memberId, cls, "Class cancelled by the gym");
    }
    await tx.classBooking.deleteMany({ where: { classId } });
    await tx.classWaitlist.deleteMany({ where: { classId } });
    await tx.class.update({ where: { id: classId }, data: { cancelledAt: new Date() } });
    await logAction(tx, actor, {
      action: "class.cancelled",
      targetType: "Class",
      targetId: classId,
      details: { name: cls.name, startTime: cls.startTime.toISOString(), bookingsRemoved: bookings.length },
    });
    return { bookingsRemoved: bookings.length };
  });
}

export async function joinWaitlist(db: Db, actor: Actor, classId: string, memberId: string) {
  return db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    if (cls.cancelledAt) throw new ApiError("conflict", "This class has been cancelled.");
    if (hasStarted(cls)) throw new ApiError("conflict", "This class has already started.");
    if (actor.kind === "member") assertBookingOpen(cls);
    await assertBookableMember(tx, actor, memberId);
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

// A member's own request checks their membership before anything about the
// class, so an inactive member hears that first.
export async function joinWaitlistAsMember(db: Db, member: MemberActor, classId: string) {
  const me = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { status: true } });
  if (me.status !== "ACTIVE") throw new ApiError("conflict", "Your membership needs to be active to join a waitlist.");
  return joinWaitlist(db, member, classId, member.id);
}

export async function leaveWaitlist(db: Db, actor: Actor, classId: string, memberId: string) {
  await db.$transaction(async (tx) => {
    const deleted = await tx.classWaitlist.deleteMany({ where: { classId, memberId } });
    if (deleted.count === 0) throw new ApiError("not_found", "Not on the waitlist.");
    await logAction(tx, actor, { action: "class.waitlist_removed", targetType: "Class", targetId: classId, details: { memberId } });
  });
}

export async function promoteFromWaitlist(db: Db, actor: Actor, classId: string, memberId: string) {
  return db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    if (cls.cancelledAt) throw new ApiError("conflict", "This class has been cancelled.");
    const booked = await tx.classBooking.count({ where: { classId } });
    if (booked >= cls.capacity) throw new ApiError("conflict", "The class is full. Free up a spot before promoting.");
    const removed = await tx.classWaitlist.deleteMany({ where: { classId, memberId } });
    if (removed.count === 0) throw new ApiError("conflict", "Member isn't on the waitlist.");
    const usedCredit = await spendClassCredit(tx, memberId, cls, { allowOverride: actor.kind === "staff" });
    const booking = await tx.classBooking.create({ data: { classId, memberId, usedCredit } });
    await logAction(tx, actor, { action: "class.waitlist_promoted", targetType: "Class", targetId: classId, details: { className: cls.name, memberId, usedCredit } });
    return booking;
  });
}

// Removes a leaving member's future bookings (archive or erasure), returning
// credits and promoting from each class's waitlist, as a cancellation by
// staff would (R-39).
export async function releaseFutureBookings(db: Db, actor: Actor, memberId: string) {
  const bookings = await db.classBooking.findMany({ where: { memberId, class: { startTime: { gt: new Date() }, cancelledAt: null } }, select: { classId: true } });
  for (const b of bookings) await cancelBooking(db, actor.kind === "member" ? { kind: "system", name: "Account deletion" } : actor, b.classId, memberId);
  await db.classWaitlist.deleteMany({ where: { memberId } });
  return bookings.length;
}

async function getTrainer(tx: Tx, trainerId: string | null | undefined) {
  if (!trainerId) return null;
  const trainer = await tx.staff.findUnique({ where: { id: trainerId }, select: { id: true, name: true } });
  if (!trainer) throw new ApiError("validation_failed", "That trainer doesn't exist.", { trainerId: "Not found" });
  return trainer;
}

export async function createClass(db: Db, staff: StaffActor, input: ClassInput) {
  return db.$transaction(async (tx) => {
    const trainer = await getTrainer(tx, input.trainerId);
    const cls = await tx.class.create({ data: { ...input, trainerId: trainer?.id ?? null, instructor: trainer?.name ?? null } });
    await logAction(tx, staff, { action: "class.created", targetType: "Class", targetId: cls.id, details: { name: cls.name, startTime: cls.startTime.toISOString(), trainer: trainer?.name ?? null } });
    return cls;
  });
}

// Trainers can only mark attendance for their own classes.
export async function markAttendance(db: Db, staff: StaffActor, classId: string, input: AttendanceInput) {
  return db.$transaction(async (tx) => {
    if (staff.role === "TRAINER") {
      const cls = await tx.class.findUnique({ where: { id: classId }, select: { trainerId: true } });
      if (!cls) throw new ApiError("not_found", "Class not found.");
      if (cls.trainerId !== staff.id) throw new ApiError("forbidden", "You can only mark attendance for your own classes.");
    }
    const booking = await tx.classBooking.update({
      where: { classId_memberId: { classId, memberId: input.memberId } },
      data: { status: input.status },
    });
    await logAction(tx, staff, { action: "class.attendance_marked", targetType: "Class", targetId: classId, details: input });
    return booking;
  });
}

export async function createTemplate(db: Db, staff: StaffActor, input: TemplateInput) {
  return db.$transaction(async (tx) => {
    await getTrainer(tx, input.trainerId);
    const t = await tx.classTemplate.create({ data: { ...input, trainerId: input.trainerId ?? null } });
    await logAction(tx, staff, { action: "timetable.slot_created", targetType: "ClassTemplate", targetId: t.id, details: { name: t.name, weekday: t.weekday, startTime: t.startTime } });
    return t;
  });
}

// Editing a slot affects classes generated from now on; existing dated
// classes are left as they are (members may already be booked).
export async function updateTemplate(db: Db, staff: StaffActor, id: string, input: TemplateInput) {
  return db.$transaction(async (tx) => {
    await getTrainer(tx, input.trainerId);
    const t = await tx.classTemplate.update({ where: { id }, data: { ...input, trainerId: input.trainerId ?? null } });
    await logAction(tx, staff, { action: "timetable.slot_updated", targetType: "ClassTemplate", targetId: t.id, details: { name: t.name } });
    return t;
  });
}

export async function deleteTemplate(db: Db, staff: StaffActor, id: string) {
  await db.$transaction(async (tx) => {
    const t = await tx.classTemplate.delete({ where: { id } });
    await logAction(tx, staff, { action: "timetable.slot_deleted", targetType: "ClassTemplate", targetId: t.id, details: { name: t.name } });
  });
}

export async function generateTimetable(db: Db, staff: StaffActor, weeks: number) {
  return db.$transaction(async (tx) => {
    const result = await generateClasses(tx, gym.business.timezone, weeks);
    await logAction(tx, staff, { action: "timetable.generated", targetType: "Class", details: { weeks, created: result.created } });
    return result;
  });
}
