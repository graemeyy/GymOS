import type { Db, Tx } from "@/lib/db";
import type { MemberActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { appUrl } from "@/lib/app-url";
import { gym } from "@/lib/config";
import { signature } from "@/lib/email";
import { sendLinkEmail } from "@/lib/email/links";
import { hitRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { consumeAuthToken, issueAuthToken } from "@/lib/auth/auth-tokens";

// Email verification for online sign-ups (D-113). Links last 24 hours and
// work once; a new one replaces the last.
const VERIFY_HOURS = 24;
const EXPIRED = "This link has expired or was already used. Sign in and ask for a new one.";

type Recipient = { id: string; name: string | null; email: string };

export async function sendEmailVerification(db: Db, member: Recipient): Promise<{ previewLink: string | null }> {
  const token = await db.$transaction(async (tx) => {
    const issued = await issueAuthToken(tx, { purpose: "EMAIL_VERIFICATION", owner: { memberId: member.id }, email: member.email, ttlMs: VERIFY_HOURS * 3_600_000 });
    await logAction(tx, { kind: "member", id: member.id, name: member.name ?? member.email, email: member.email }, { action: "member.email_verification_sent", targetType: "Member", targetId: member.id });
    return issued;
  });
  const link = appUrl(`/verify-email?token=${token}`);
  return sendLinkEmail(
    {
      to: member.email,
      subject: `Confirm your email for ${gym.brand.shortName}`,
      text: `Hi ${member.name?.split(" ")[0] ?? "there"},\n\nPlease confirm this is your email address by opening this link within ${VERIFY_HOURS} hours:\n\n${link}\n\nUntil you do, you can't pay for a membership or shop orders online. If you didn't sign up, ignore this email.${signature()}`,
    },
    link
  );
}

// "Send it again" from the banner. At most three an hour per member.
export async function resendEmailVerification(db: Db, actor: MemberActor) {
  const member = await db.member.findUniqueOrThrow({ where: { id: actor.id }, select: { id: true, name: true, email: true, emailVerifiedAt: true } });
  if (member.emailVerifiedAt) throw new ApiError("conflict", "Your email address is already confirmed.");
  if (!(await hitRateLimit(RATE_LIMITS.emailVerificationResend, member.id, db)).allowed) {
    throw new ApiError("rate_limited", "We've sent a few links already. Check your inbox and spam folder, or try again in an hour.");
  }
  return sendEmailVerification(db, member);
}

// Confirms the address the link was sent to. If the member's email has
// changed since, the old link no longer confirms anything.
export async function verifyEmail(db: Db, token: string) {
  return db.$transaction(async (tx) => {
    const row = await consumeAuthToken(tx, token, "EMAIL_VERIFICATION");
    if (!row?.memberId) throw new ApiError("not_found", EXPIRED);
    const member = await tx.member.findUniqueOrThrow({ where: { id: row.memberId }, select: { id: true, name: true, email: true, emailVerifiedAt: true, archivedAt: true } });
    if (member.archivedAt || member.email !== row.email) throw new ApiError("not_found", EXPIRED);
    if (!member.emailVerifiedAt) await tx.member.update({ where: { id: member.id }, data: { emailVerifiedAt: new Date() } });
    await logAction(tx, { kind: "member", id: member.id, name: member.name ?? member.email, email: member.email }, { action: "member.email_verified", targetType: "Member", targetId: member.id });
    return { ok: true as const };
  });
}

// What an unverified member can't do yet (D-114): pay online. Everything
// else (signing in, their account, terms, browsing classes and the shop)
// works, so they can find the banner and the link.
export async function assertEmailVerified(db: Db | Tx, memberId: string) {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { emailVerifiedAt: true } });
  if (!member.emailVerifiedAt) {
    throw new ApiError("email_unverified", "Confirm your email address before paying online. We've sent you a link; you can ask for another from the banner at the top of the page.");
  }
}
