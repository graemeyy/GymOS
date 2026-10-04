import type { Db, Tx } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { logAction, type Actor } from "@/lib/audit";

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

export async function bookMember(db: Db, actor: Actor, classId: string, memberId: string) {
  return db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    await assertBookableMember(tx, memberId);
    if (cls.startTime.getTime() < Date.now() - 60 * 60 * 1000) throw new ApiError("conflict", "This class has already finished.");
    const existing = await tx.classBooking.findUnique({ where: { classId_memberId: { classId, memberId } } });
    if (existing) throw new ApiError("conflict", "Already booked into this class.");
    const booked = await tx.classBooking.count({ where: { classId } });
    if (booked >= cls.capacity) throw new ApiError("conflict", "This class is full. Join the waitlist instead.");
    const booking = await tx.classBooking.create({ data: { classId, memberId } });
    await tx.classWaitlist.deleteMany({ where: { classId, memberId } });
    await logAction(tx, actor, { action: "class.booked", targetType: "Class", targetId: classId, details: { className: cls.name, memberId } });
    return booking;
  });
}

export async function cancelBooking(db: Db, actor: Actor, classId: string, memberId: string) {
  return db.$transaction(async (tx) => {
    const cls = await lockClass(tx, classId);
    const deleted = await tx.classBooking.deleteMany({ where: { classId, memberId } });
    if (deleted.count === 0) throw new ApiError("not_found", "No booking to cancel.");
    await logAction(tx, actor, { action: "class.booking_cancelled", targetType: "Class", targetId: classId, details: { className: cls.name, memberId } });
  });
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
    const booking = await tx.classBooking.create({ data: { classId, memberId } });
    await logAction(tx, actor, { action: "class.waitlist_promoted", targetType: "Class", targetId: classId, details: { className: cls.name, memberId } });
    return booking;
  });
}
