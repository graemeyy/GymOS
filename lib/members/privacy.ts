import { can, type Access } from "@/lib/auth/permissions";

// Members' private details (members.view_sensitive): email and contact
// details, staff notes, payment history and amounts owing. Staff without that
// permission get the record with these set to null, so screens keep their
// shape and show a lock instead.
const PRIVATE_KEYS = ["email", "notes", "payments", "amountOwingCents"] as const;

type Redactable = Record<string, unknown>;

export function canSeePrivateDetails(access: Access) {
  return can(access, "members.view_sensitive");
}

// Money shown on a member (payments, amounts owing) needs both private
// details and finance.view.
export function canSeeMemberMoney(access: Access) {
  return can(access, "members.view_sensitive") && can(access, "finance.view");
}

function redact<T extends Redactable>(row: T): T {
  const copy: Redactable = { ...row };
  for (const key of PRIVATE_KEYS) if (key in copy) copy[key] = null;
  for (const key of ["referredBy", "member"]) {
    const nested = copy[key];
    if (nested && typeof nested === "object") copy[key] = redact(nested as Redactable);
  }
  if (Array.isArray(copy.referrals)) copy.referrals = copy.referrals.map((r) => redact(r as Redactable));
  return copy as T;
}

/** The record as this staff member may see it. */
export function forViewer<T extends Redactable>(access: Access, row: T): T {
  return canSeePrivateDetails(access) ? row : redact(row);
}
