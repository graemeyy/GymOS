// Every staff route checks a permission, not a role rank, so a role's access
// can be read off this table in one place.

export const STAFF_ROLES = ["OWNER", "MANAGER", "FRONT_DESK", "TRAINER"] as const;
export type StaffRoleName = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRoleName, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  FRONT_DESK: "Front desk",
  TRAINER: "Trainer",
};

export const PERMISSIONS = [
  "dashboard:view",
  "revenue:view",
  "members:read",
  "members:write",
  "members:archive",
  "plans:manage",
  "billing:manage",
  "billing:refund",
  "finance:view",
  "shop:manage",
  "orders:fulfil",
  "classes:read",
  "classes:manage",
  "classes:book",
  "classes:attendance",
  "checkin:scan",
  "staff:read",
  "staff:manage",
  "shifts:read",
  "shifts:manage",
  "audit:read",
  "settings:manage",
  "equipment:read",
  "equipment:manage",
  "inventory:read",
  "inventory:adjust",
  "inventory:manage",
  "announcements:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const FRONT_DESK: Permission[] = [
  "dashboard:view",
  "revenue:view",
  "members:read",
  "members:write",
  "classes:read",
  "classes:book",
  "classes:attendance",
  "checkin:scan",
  "orders:fulfil",
  "shifts:read",
  "equipment:read",
  "inventory:read",
  "inventory:adjust",
];

const TRAINER: Permission[] = ["dashboard:view", "members:read", "classes:read", "classes:attendance", "shifts:read"];

const OWNER_ONLY: Permission[] = ["staff:manage", "plans:manage", "settings:manage"];

const GRANTS: Record<StaffRoleName, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  MANAGER: new Set(PERMISSIONS.filter((p) => !OWNER_ONLY.includes(p))),
  FRONT_DESK: new Set(FRONT_DESK),
  TRAINER: new Set(TRAINER),
};

export interface PermissionContext {
  // GymSettings.hideRevenueFromFrontDesk, enforced here on the server.
  hideRevenueFromFrontDesk?: boolean;
}

export function can(role: StaffRoleName | null | undefined, permission: Permission, ctx: PermissionContext = {}): boolean {
  if (!role || !(role in GRANTS)) return false;
  if (permission === "revenue:view" && role === "FRONT_DESK" && ctx.hideRevenueFromFrontDesk) return false;
  return GRANTS[role].has(permission);
}

export function permissionsFor(role: StaffRoleName, ctx: PermissionContext = {}): Permission[] {
  return PERMISSIONS.filter((p) => can(role, p, ctx));
}

export function isStaffRole(value: unknown): value is StaffRoleName {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}
