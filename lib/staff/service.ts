import { appUrl } from "@/lib/app-url";
import { createHash, randomBytes } from "crypto";
import type { Db, Tx } from "@/lib/db";
import type { StaffActor } from "@/lib/auth/session";
import { ApiError } from "@/lib/http/errors";
import { logAction } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email";
import { DAY_MS } from "@/lib/time";
import { assertCanGrant, assertNotMorePowerful, legacyRoleFor } from "@/lib/roles/service";
import { getPresetRole } from "@/lib/roles/queries";
import { effectivePermissions } from "@/lib/auth/permissions";
import { staffSelect, toStaffView } from "./queries";
import type { FirstOwnerInput, InviteStaffInput, UpdateStaffInput } from "./schema";
import { getBranding } from "@/lib/branding/service";

const INVITE_DAYS = 7;
// Changes that could leave the gym without an owner take this advisory lock
// before counting owners, so two owners can't demote each other at once.
const OWNER_LOCK = 424243;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function activeOwnerCount(tx: Tx, excludeId: string) {
  return tx.staff.count({ where: { id: { not: excludeId }, deactivatedAt: null, assignedRole: { isOwner: true } } });
}

// The first staff account, as Owner. Refused once any account exists; an
// advisory lock serialises two simultaneous first-run requests.
export async function createFirstOwner(db: Db, input: FirstOwnerInput) {
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
    if ((await tx.staff.count()) > 0) throw new ApiError("conflict", "Setup has already been completed.");
    const owner = await getPresetRole(tx, "OWNER");
    if (!owner) throw new ApiError("internal", "The Owner role is missing. Run the database migrations.");
    const created = await tx.staff.create({ data: { name: input.name, email: input.email, passwordHash, role: "OWNER", roleId: owner.id } });
    await logAction(tx, { kind: "staff", id: created.id, name: created.name }, { action: "staff.created", targetType: "Staff", targetId: created.id, details: { name: created.name, note: "Initial setup" }, after: { name: created.name, email: created.email, role: owner.name } });
    return created;
  });
}

// Invites someone by email with a role. They set their own password from the
// link, which works once and for seven days. Without email configured, the
// link is returned so the inviter can pass it on in person.
export async function inviteStaff(db: Db, actor: StaffActor, input: InviteStaffInput) {
  const token = randomBytes(32).toString("base64url");
  const result = await db.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw new ApiError("validation_failed", "Choose a role.", { roleId: "Not found" });
    assertNotMorePowerful(actor, role, "who gets the Owner role");
    if (await tx.staff.findUnique({ where: { email: input.email } })) throw new ApiError("conflict", "A staff account with that email already exists.", { email: "Already in use" });
    const created = await tx.staff.create({
      data: { name: input.name, email: input.email, roleId: role.id, role: legacyRoleFor(role), mustChangePassword: true, inviteTokenHash: hashToken(token), inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * DAY_MS) },
      select: staffSelect,
    });
    await logAction(tx, actor, { action: "staff.invited", targetType: "Staff", targetId: created.id, details: { name: created.name }, after: { name: created.name, email: created.email, role: role.name } });
    return created;
  });
  const inviteUrl = appUrl(`/admin/invite?token=${token}`);
  const { name: gymName } = await getBranding(db);
  const email = await sendEmail({
    to: input.email,
    subject: `You're invited to ${gymName}'s staff console`,
    text: `Hi ${input.name},\n\n${actor.name} has invited you to the ${gymName} staff console. Set your password here (the link works for ${INVITE_DAYS} days):\n\n${inviteUrl}\n\nIf you weren't expecting this, you can ignore this email.`,
  });
  return { staff: toStaffView(result), emailed: email.sent, inviteUrl: email.sent ? null : inviteUrl };
}

// A new link for someone who hasn't accepted yet; the old link stops working.
export async function resendInvite(db: Db, actor: StaffActor, id: string) {
  const token = randomBytes(32).toString("base64url");
  const row = await db.$transaction(async (tx) => {
    const existing = await tx.staff.findUnique({ where: { id }, include: { assignedRole: true } });
    if (!existing) throw new ApiError("not_found", "Staff account not found.");
    if (existing.assignedRole) assertNotMorePowerful(actor, existing.assignedRole, "this person's invitation");
    if (!existing.inviteExpiresAt) throw new ApiError("conflict", "This person has already set their password.");
    const updated = await tx.staff.update({ where: { id }, data: { inviteTokenHash: hashToken(token), inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * DAY_MS) }, select: staffSelect });
    await logAction(tx, actor, { action: "staff.invite_resent", targetType: "Staff", targetId: id, details: { name: updated.name } });
    return updated;
  });
  const inviteUrl = appUrl(`/admin/invite?token=${token}`);
  const { name: gymName } = await getBranding(db);
  const email = await sendEmail({ to: row.email, subject: `Your invitation to ${gymName}'s staff console`, text: `Hi ${row.name},\n\nHere's a new link to set your password (it works for ${INVITE_DAYS} days):\n\n${inviteUrl}` });
  return { staff: toStaffView(row), emailed: email.sent, inviteUrl: email.sent ? null : inviteUrl };
}

export async function getInvite(db: Db, token: string) {
  const staff = await db.staff.findUnique({ where: { inviteTokenHash: hashToken(token) }, select: { name: true, email: true, inviteExpiresAt: true, deactivatedAt: true } });
  if (!staff || staff.deactivatedAt || !staff.inviteExpiresAt || staff.inviteExpiresAt < new Date()) throw new ApiError("not_found", "This invitation has expired or was already used. Ask for a new one.");
  return { name: staff.name, email: staff.email };
}

// Sets the password and uses up the invitation in one statement, so a link
// can't be used twice.
export async function acceptInvite(db: Db, token: string, password: string) {
  const passwordHash = await hashPassword(password);
  return db.$transaction(async (tx) => {
    const staff = await tx.staff.findUnique({ where: { inviteTokenHash: hashToken(token) } });
    if (!staff || staff.deactivatedAt || !staff.inviteExpiresAt || staff.inviteExpiresAt < new Date()) throw new ApiError("not_found", "This invitation has expired or was already used. Ask for a new one.");
    // Choosing a password from the invitation is the required change (D-111).
    const updated = await tx.staff.update({ where: { id: staff.id }, data: { passwordHash, mustChangePassword: false, inviteTokenHash: null, inviteExpiresAt: null, sessionVersion: { increment: 1 } } });
    await logAction(tx, { kind: "staff", id: staff.id, name: staff.name }, { action: "staff.invite_accepted", targetType: "Staff", targetId: staff.id, details: { name: staff.name } });
    return updated;
  });
}

// Name, role and active status. The safeguards (D-099):
// - nobody changes their own role or deactivates themselves;
// - only an owner gives, takes away or changes the Owner role, or touches an owner;
// - nobody gives a role with permissions they don't hold, or changes someone
//   whose role is more powerful than theirs;
// - there's always at least one active owner.
// A role change or deactivation signs the person out everywhere.
export async function updateStaff(db: Db, actor: StaffActor, id: string, input: UpdateStaffInput) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${OWNER_LOCK})`;
    const existing = await tx.staff.findUnique({ where: { id }, include: { assignedRole: true } });
    if (!existing) throw new ApiError("not_found", "Staff account not found.");
    const roleChange = input.roleId !== undefined && input.roleId !== existing.roleId;
    const activeChange = input.active !== undefined && input.active !== !existing.deactivatedAt;
    if ((roleChange || activeChange) && existing.id === actor.id) throw new ApiError("conflict", "You can't change your own role or deactivate your own account.");
    if ((roleChange || activeChange) && existing.assignedRole) assertNotMorePowerful(actor, existing.assignedRole, "an owner's account");

    const newRole = roleChange ? await tx.role.findUnique({ where: { id: input.roleId } }) : existing.assignedRole;
    if (roleChange && !newRole) throw new ApiError("validation_failed", "Choose a role.", { roleId: "Not found" });
    if (roleChange && newRole) {
      if (newRole.isOwner && !actor.isOwner) throw new ApiError("forbidden", "Only an owner can give someone the Owner role.");
      assertCanGrant(actor, effectivePermissions(newRole));
    }
    const losesOwner = existing.assignedRole?.isOwner && !existing.deactivatedAt && ((roleChange && !newRole?.isOwner) || input.active === false);
    if (losesOwner && (await activeOwnerCount(tx, existing.id)) === 0) throw new ApiError("conflict", "There must always be at least one active owner. Make someone else an owner first.");

    const updated = await tx.staff.update({
      where: { id },
      data: {
        name: input.name,
        roleId: roleChange ? newRole?.id : undefined,
        role: roleChange && newRole ? legacyRoleFor(newRole) : undefined,
        deactivatedAt: activeChange ? (input.active ? null : new Date()) : undefined,
        ...(roleChange || activeChange ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: staffSelect,
    });
    const before = { name: existing.name, role: existing.assignedRole?.name ?? null, active: !existing.deactivatedAt };
    const after = { name: updated.name, role: updated.assignedRole?.name ?? null, active: !updated.deactivatedAt };
    const action = activeChange ? (input.active ? "staff.reactivated" : "staff.deactivated") : roleChange ? "staff.role_changed" : "staff.updated";
    await logAction(tx, actor, { action, targetType: "Staff", targetId: id, details: { name: updated.name }, before, after });
    return toStaffView(updated);
  });
}

// Other sessions for the account end; the caller issues this one a fresh
// cookie from the returned session version.
export async function changeOwnPassword(db: Db, staff: StaffActor, currentPassword: string, newPassword: string) {
  const record = await db.staff.findUniqueOrThrow({ where: { id: staff.id } });
  if (!record.passwordHash || !(await verifyPassword(currentPassword, record.passwordHash))) {
    throw new ApiError("validation_failed", "That isn't your current password.", { currentPassword: "Incorrect" });
  }
  if (newPassword === currentPassword) throw new ApiError("validation_failed", "Choose a password that's different from your current one.", { newPassword: "Same as your current password" });
  const passwordHash = await hashPassword(newPassword);
  return db.$transaction(async (tx) => {
    const updated = await tx.staff.update({ where: { id: staff.id }, data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } } });
    await logAction(tx, staff, { action: "staff.password_changed", targetType: "Staff", targetId: staff.id });
    return updated;
  });
}

export function recordStaffSignIn(db: Db, staff: { id: string; name: string }) {
  return logAction(db, { kind: "staff", id: staff.id, name: staff.name }, { action: "staff.signed_in", targetType: "Staff", targetId: staff.id });
}

// Failed staff sign-ins go in the audit log against the account (R-84). An
// email that isn't a staff account isn't recorded: it's no one's data.
export async function recordFailedStaffSignIn(db: Db, email: string, reason: "wrong_password" | "deactivated" | "locked") {
  const staff = await db.staff.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!staff) return;
  // Logged as a system event: whoever tried may not be the account holder.
  await logAction(db, { kind: "system", name: "Sign-in attempt" }, { action: "staff.sign_in_failed", targetType: "Staff", targetId: staff.id, details: { name: staff.name, reason } });
}
