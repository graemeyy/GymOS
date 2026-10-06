import { appUrl } from "@/lib/app-url";
import { prisma, type Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { signPayload, verifyPayload } from "@/lib/auth/token";

// One-click unsubscribe for optional emails (Spam Act 2003, D-118). Each
// email carries a link signed for one member and one kind of email, for the
// "unsubscribe" purpose only, so it can't be turned into a session, a pass,
// or another member's link. It doesn't expire: the Act needs the link to keep
// working, and all it can do is switch an email off.
export const UNSUBSCRIBE_TOPICS = {
  announcements: { field: "notifyAnnouncements", label: "gym news emails" },
  waitlist: { field: "notifyWaitlist", label: "waitlist emails" },
} as const;

export type UnsubscribeTopic = keyof typeof UNSUBSCRIBE_TOPICS;

interface UnsubscribePayload {
  m: string;
  t: UnsubscribeTopic;
}

const PURPOSE = "unsubscribe";

export function createUnsubscribeToken(memberId: string, topic: UnsubscribeTopic): Promise<string> {
  return signPayload(PURPOSE, { m: memberId, t: topic } satisfies UnsubscribePayload);
}

export async function readUnsubscribeToken(token: string | null | undefined): Promise<UnsubscribePayload | null> {
  const payload = await verifyPayload<Record<string, unknown>>(PURPOSE, token);
  if (!payload || typeof payload.m !== "string" || !payload.m) return null;
  if (typeof payload.t !== "string" || !Object.hasOwn(UNSUBSCRIBE_TOPICS, payload.t)) return null;
  return { m: payload.m, t: payload.t as UnsubscribeTopic };
}

// The link in the email's text opens a page with one button; the
// List-Unsubscribe header points straight at the API, which mail apps POST
// to when someone presses their own "Unsubscribe" button (RFC 8058).
export async function unsubscribeLinks(memberId: string, topic: UnsubscribeTopic) {
  const token = encodeURIComponent(await createUnsubscribeToken(memberId, topic));
  const page = appUrl(`/unsubscribe?token=${token}`);
  const oneClick = appUrl(`/api/unsubscribe?token=${token}`);
  return {
    page,
    headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

function invalid(): never {
  throw new ApiError("not_found", "This unsubscribe link isn't valid. You can switch emails off in your account instead.");
}

// "j••••@example.com": enough for the person to recognise their address
// without the page showing it in full to whoever has the link.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"•".repeat(Math.max(1, Math.min(local.length - 1, 4)))}@${domain ?? ""}`;
}

async function memberFor(db: Db, token: string) {
  const payload = await readUnsubscribeToken(token);
  if (!payload) invalid();
  const member = await db.member.findUnique({ where: { id: payload.m }, select: { id: true, email: true, anonymisedAt: true, notifyAnnouncements: true, notifyWaitlist: true } });
  if (!member || member.anonymisedAt) invalid();
  return { member, topic: payload.t };
}

export async function describeUnsubscribe(db: Db, token: string) {
  const { member, topic } = await memberFor(db, token);
  const { field, label } = UNSUBSCRIBE_TOPICS[topic];
  return { topic, label, email: maskEmail(member.email), subscribed: member[field] };
}

// Switches the email off. Pressing it twice is fine: the second press
// changes nothing and isn't recorded again.
export async function unsubscribe(token: string, via: "page" | "one-click", db: Db = prisma) {
  const { member, topic } = await memberFor(db, token);
  const { field, label } = UNSUBSCRIBE_TOPICS[topic];
  const changed = await db.$transaction(async (tx) => {
    const updated = await tx.member.updateMany({ where: { id: member.id, [field]: true }, data: { [field]: false } });
    if (updated.count === 0) return false;
    await logAction(tx, { kind: "system", name: "Unsubscribe link" }, {
      action: "member.unsubscribed",
      targetType: "Member",
      targetId: member.id,
      details: { topic, via },
      before: { [field]: true },
      after: { [field]: false },
    });
    return true;
  });
  return { topic, label, changed };
}
