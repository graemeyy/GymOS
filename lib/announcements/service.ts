import type { Announcement } from "@prisma/client";
import type { Db } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { sendEmail, signature } from "@/lib/email";
import { unsubscribeLinks } from "@/lib/members/unsubscribe";
import { audienceWhere } from "./queries";
import { assertLocation, seesAllLocations } from "@/lib/locations/scope";
import type { AnnouncementInput } from "./schema";
import { getBranding } from "@/lib/branding/service";

function announcementData(input: AnnouncementInput) {
  return { ...input, planId: input.audience === "PLAN" ? input.planId : null, expiresAt: input.expiresAt ?? null, locationId: input.locationId ?? null };
}

// Someone whose role covers some locations announces to those locations
// only; an announcement for everyone needs a role that covers them all (D-128).
function assertAnnouncementScope(staff: StaffActor, locationId: string | null | undefined) {
  if (locationId) assertLocation(staff, locationId);
  else if (!seesAllLocations(staff)) throw new ApiError("forbidden", "Your role covers some locations only. Choose one of them.", { locationId: "Choose a location" });
}

export function createAnnouncement(db: Db, staff: StaffActor, input: AnnouncementInput) {
  return db.$transaction(async (tx) => {
    assertAnnouncementScope(staff, input.locationId);
    const a = await tx.announcement.create({ data: { ...announcementData(input), createdById: staff.id } });
    await logAction(tx, staff, { action: "announcement.created", targetType: "Announcement", targetId: a.id, details: { title: a.title } });
    return a;
  });
}

export function updateAnnouncement(db: Db, staff: StaffActor, id: string, input: AnnouncementInput) {
  return db.$transaction(async (tx) => {
    const existing = await tx.announcement.findUnique({ where: { id } });
    if (!existing) throw new ApiError("not_found", "Announcement not found.");
    assertAnnouncementScope(staff, existing.locationId);
    assertAnnouncementScope(staff, input.locationId);
    if (existing.emailedAt) throw new ApiError("conflict", "This announcement has already been emailed, so it can't be edited. Post a correction instead.");
    const a = await tx.announcement.update({ where: { id }, data: announcementData(input) });
    await logAction(tx, staff, { action: "announcement.updated", targetType: "Announcement", targetId: a.id, details: { title: a.title } });
    return a;
  });
}

export function deleteAnnouncement(db: Db, staff: StaffActor, id: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.announcement.findUnique({ where: { id }, select: { locationId: true } });
    if (!existing) throw new ApiError("not_found", "Announcement not found.");
    assertAnnouncementScope(staff, existing.locationId);
    const a = await tx.announcement.delete({ where: { id } });
    await logAction(tx, staff, { action: "announcement.deleted", targetType: "Announcement", targetId: a.id, details: { title: a.title } });
  });
}

function publishedEntry(a: Announcement, emailed: number) {
  return { action: "announcement.published", targetType: "Announcement", targetId: a.id, details: { title: a.title, emailed } };
}

// Publishing an announcement that is already live keeps its original date.
// Returns how many members were emailed.
export async function publishAnnouncement(db: Db, staff: StaffActor, id: string, email: boolean): Promise<number> {
  const a = await db.$transaction(async (tx) => {
    const existing = await tx.announcement.findUnique({ where: { id } });
    if (!existing) throw new ApiError("not_found", "Announcement not found.");
    assertAnnouncementScope(staff, existing.locationId);
    const published = existing.publishedAt ? existing : await tx.announcement.update({ where: { id }, data: { publishedAt: new Date() } });
    if (!email) await logAction(tx, staff, publishedEntry(published, 0));
    return published;
  });
  if (!email) return 0;
  // Sent emails can't be recalled, so they go out only after the publish has
  // committed. The audit entry records how many were sent, so it follows them.
  const { sent } = await emailAnnouncement(db, a.id);
  await logAction(db, staff, publishedEntry(a, sent));
  return sent;
}

// Emails a published announcement to members in its audience who haven't
// turned announcement emails off. The send is claimed first (emailedAt set
// atomically), so two clicks or a retry can't email everyone twice (R-16).
export async function emailAnnouncement(db: Db, announcementId: string) {
  const a = await db.announcement.findUniqueOrThrow({ where: { id: announcementId } });
  const where = audienceWhere(a);
  if (!where) return { sent: 0, alreadySent: false };
  const claimed = await db.announcement.updateMany({ where: { id: a.id, emailedAt: null }, data: { emailedAt: new Date() } });
  if (claimed.count === 0) return { sent: 0, alreadySent: true };
  // Only addresses the member has confirmed (D-114).
  const recipients = await db.member.findMany({ where: { ...where, notifyAnnouncements: true, emailVerifiedAt: { not: null } }, select: { id: true, email: true, name: true } });
  const { appName } = await getBranding(db);
  let sent = 0;
  for (const r of recipients) {
    // Every announcement email can be stopped in one click (D-118).
    const unsubscribe = await unsubscribeLinks(r.id, "announcements");
    const res = await sendEmail({
      to: r.email,
      subject: `${appName}: ${a.title}`,
      text: `Hi ${r.name?.split(" ")[0] ?? "there"},\n\n${a.body}${await signature()}\n\nUnsubscribe from gym news emails: ${unsubscribe.page}`,
      headers: unsubscribe.headers,
    });
    if (res.sent) sent++;
  }
  await db.announcement.update({ where: { id: a.id }, data: { emailCount: sent } });
  return { sent, alreadySent: false };
}
