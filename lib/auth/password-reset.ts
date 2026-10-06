import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { appUrl } from "@/lib/app-url";
import { hashPassword } from "@/lib/auth/password";
import { linksGoOnScreen, runAfterResponse, sendLinkEmail } from "@/lib/email/links";
import { signature } from "@/lib/email";
import { hitRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { consumeAuthToken, findUsableAuthToken, issueAuthToken } from "./auth-tokens";
import { getBranding } from "@/lib/branding/service";

export type AccountKind = "staff" | "member";

const RESET_MINUTES = 60;
const EXPIRED = "This reset link has expired or was already used. Ask for a new one.";
// The system, not the person: whoever asked may not own the account.
const REQUESTER = { kind: "system" as const, name: "Password reset request" };

async function findAccount(db: Db, kind: AccountKind, email: string) {
  if (kind === "staff") {
    const staff = await db.staff.findUnique({ where: { email }, select: { id: true, name: true, email: true, deactivatedAt: true } });
    return staff && !staff.deactivatedAt ? { owner: { staffId: staff.id }, id: staff.id, name: staff.name, email: staff.email } : null;
  }
  const member = await db.member.findUnique({ where: { email }, select: { id: true, name: true, email: true, archivedAt: true, anonymisedAt: true } });
  return member && !member.archivedAt && !member.anonymisedAt ? { owner: { memberId: member.id }, id: member.id, name: member.name ?? "there", email: member.email } : null;
}

// Forgotten password (D-112). The answer is the same whether or not the
// email has an account. With email set up, all the work (finding the
// account, making the link, sending it) happens after the response, so its
// timing says nothing either. Each account gets at most three links an hour;
// extra requests are silently ignored. Outside production, with no email
// provider, the link comes back for the screen instead (D-115).
export async function requestPasswordReset(db: Db, kind: AccountKind, email: string): Promise<{ previewLink: string | null }> {
  if (linksGoOnScreen()) return issueResetLink(db, kind, email);
  await runAfterResponse(() => issueResetLink(db, kind, email));
  return { previewLink: null };
}

async function issueResetLink(db: Db, kind: AccountKind, email: string): Promise<{ previewLink: string | null }> {
  const account = await findAccount(db, kind, email);
  if (!account) return { previewLink: null };
  if (!(await hitRateLimit(RATE_LIMITS.passwordResetPerAccount, `${kind}:${account.id}`, db)).allowed) return { previewLink: null };

  const token = await db.$transaction(async (tx) => {
    const issued = await issueAuthToken(tx, { purpose: "PASSWORD_RESET", owner: account.owner, email: account.email, ttlMs: RESET_MINUTES * 60_000 });
    await logAction(tx, REQUESTER, { action: `${kind}.password_reset_requested`, targetType: kind === "staff" ? "Staff" : "Member", targetId: account.id });
    return issued;
  });
  const link = appUrl(`${kind === "staff" ? "/admin" : ""}/reset-password?token=${token}`);
  return sendLinkEmail(
    {
      to: account.email,
      subject: `Reset your ${(await getBranding(db)).appName} password`,
      text: `Hi ${account.name.split(" ")[0]},\n\nSomeone asked to reset the password for this ${kind === "staff" ? "staff" : "member"} account. To choose a new one, open this link within ${RESET_MINUTES} minutes:\n\n${link}\n\nIt works once. If you didn't ask, ignore this email; your password hasn't changed.${await signature()}`,
    },
    link
  );
}

/** Whether a reset link can still be used, and for which kind of account. */
export async function checkResetLink(db: Db, token: string): Promise<{ kind: AccountKind }> {
  const row = await findUsableAuthToken(db, token, "PASSWORD_RESET");
  if (!row) throw new ApiError("not_found", EXPIRED);
  return { kind: row.staffId ? "staff" : "member" };
}

// Sets the new password and uses up the link in one transaction. Every
// session for the account ends (the session version moves on); the caller
// signs this browser in afresh. A reset also counts as choosing their own
// password (D-111) and, for a member, as confirming their email (D-113),
// since only someone who reads that inbox could open the link.
export async function resetPassword(db: Db, token: string, password: string) {
  const passwordHash = await hashPassword(password);
  return db.$transaction(async (tx) => {
    const row = await consumeAuthToken(tx, token, "PASSWORD_RESET");
    if (!row) throw new ApiError("not_found", EXPIRED);
    if (row.staffId) {
      const current = await tx.staff.findUniqueOrThrow({ where: { id: row.staffId }, select: { email: true, deactivatedAt: true } });
      if (current.deactivatedAt || current.email !== row.email) throw new ApiError("not_found", EXPIRED);
      const staff = await tx.staff.update({
        where: { id: row.staffId },
        data: { passwordHash, mustChangePassword: false, inviteTokenHash: null, inviteExpiresAt: null, sessionVersion: { increment: 1 } },
        select: { id: true, name: true, sessionVersion: true },
      });
      await logAction(tx, { kind: "staff", id: staff.id, name: staff.name }, { action: "staff.password_reset", targetType: "Staff", targetId: staff.id });
      return { kind: "staff" as const, ...staff };
    }
    const current = await tx.member.findUniqueOrThrow({ where: { id: row.memberId! }, select: { email: true, archivedAt: true, anonymisedAt: true, emailVerifiedAt: true } });
    if (current.archivedAt || current.anonymisedAt || current.email !== row.email) throw new ApiError("not_found", EXPIRED);
    const member = await tx.member.update({
      where: { id: row.memberId! },
      data: { passwordHash, mustChangePassword: false, emailVerifiedAt: current.emailVerifiedAt ?? new Date(), sessionVersion: { increment: 1 } },
      select: { id: true, name: true, email: true, sessionVersion: true },
    });
    await logAction(tx, { kind: "member", id: member.id, name: member.name ?? member.email, email: member.email }, { action: "member.password_reset", targetType: "Member", targetId: member.id });
    return { kind: "member" as const, id: member.id, name: member.name ?? member.email, sessionVersion: member.sessionVersion };
  });
}
