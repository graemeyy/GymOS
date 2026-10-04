import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { gym } from "@/lib/config";
import { sendEmail, signature } from "@/lib/email";

export function audienceWhere(a: { audience: "ALL_ACTIVE" | "PLAN" | "STAFF_ONLY"; planId: string | null }): Prisma.MemberWhereInput | null {
  if (a.audience === "STAFF_ONLY") return null;
  return {
    archivedAt: null,
    status: { in: ["ACTIVE", "PAST_DUE", "PAUSED"] },
    ...(a.audience === "PLAN" && a.planId ? { planId: a.planId } : {}),
  };
}

// Emails a published announcement to members in its audience who haven't
// turned announcement emails off. Sends once; the count is recorded.
export async function emailAnnouncement(db: Db, announcementId: string) {
  const a = await db.announcement.findUniqueOrThrow({ where: { id: announcementId } });
  if (a.emailedAt) return { sent: 0, alreadySent: true };
  const where = audienceWhere(a);
  if (!where) return { sent: 0, alreadySent: false };
  const recipients = await db.member.findMany({ where: { ...where, notifyAnnouncements: true }, select: { email: true, name: true } });
  let sent = 0;
  for (const r of recipients) {
    const res = await sendEmail({
      to: r.email,
      subject: `${gym.brand.shortName}: ${a.title}`,
      text: `Hi ${r.name?.split(" ")[0] ?? "there"},\n\n${a.body}\n\nYou can turn these emails off in your member profile.${signature()}`,
    });
    if (res.sent) sent++;
  }
  await db.announcement.update({ where: { id: a.id }, data: { emailedAt: new Date(), emailCount: sent } });
  return { sent, alreadySent: false };
}

export function isLive(a: { publishedAt: Date | null; expiresAt: Date | null }, now = new Date()) {
  return Boolean(a.publishedAt && a.publishedAt <= now && (!a.expiresAt || a.expiresAt > now));
}
