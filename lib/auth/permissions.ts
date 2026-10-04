// The permission catalogue and the preset roles (docs/PERMISSIONS.md). Roles
// live in the database (Role); this file defines what a permission means and
// what each preset starts with. No imports, so the browser can use it too.

export const PERMISSIONS = [
  "members.view",
  "members.view_sensitive",
  "members.edit",
  "classes.manage",
  "bookings.manage",
  "checkin.scan",
  "orders.manage",
  "products.edit",
  "prices.edit",
  "plans.edit",
  "finance.view",
  "finance.export",
  "refunds.issue",
  "announcements.send",
  "settings.edit",
  "staff.manage",
  "roles.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

// What each permission allows, in the words the roles page and
// docs/PERMISSIONS.md use.
export const PERMISSION_INFO: Record<Permission, { label: string; detail: string }> = {
  "members.view": { label: "See members", detail: "The member list and each member's name, status, plan, visits and class bookings." },
  "members.view_sensitive": { label: "See members' private details", detail: "Email and contact details, staff notes, payment history and amounts owing." },
  "members.edit": { label: "Add and change members", detail: "Add members, edit their details, write notes, change, pause or cancel memberships, adjust benefits, reissue passes and archive members." },
  "classes.manage": { label: "Run the timetable and roster", detail: "Create, edit and cancel classes and timetable slots, and edit staff shifts." },
  "bookings.manage": { label: "Manage bookings", detail: "Book members into any class, manage waitlists and mark attendance for any class." },
  "checkin.scan": { label: "Check members in", detail: "Scan passes or look members up at the front desk and record visits." },
  "orders.manage": { label: "Handle shop orders", detail: "Pack, hand over and cancel shop orders, and adjust stock counts." },
  "products.edit": { label: "Edit products, stock and equipment", detail: "Add and edit shop products, stock items and equipment records, and approve repairs. Prices need “Change prices”." },
  "prices.edit": { label: "Change prices", detail: "Set or change what a membership plan costs (price, billing interval and guest rate) or a shop product's prices." },
  "plans.edit": { label: "Edit plans", detail: "Change plans' names, descriptions and benefits, and retire them. New plans and anything about what a plan costs need “Change prices” too." },
  "finance.view": { label: "See money", detail: "Payments, takings, finance reports, revenue on the dashboard and plan member counts." },
  "finance.export": { label: "Download finance reports", detail: "Finance CSV exports for the accountant or BAS." },
  "refunds.issue": { label: "Issue refunds", detail: "Refund payments through Stripe or record a manual refund." },
  "announcements.send": { label: "Send announcements", detail: "Write, publish and email announcements to members or staff." },
  "settings.edit": { label: "Change settings", detail: "Gym settings such as keycard entry." },
  "staff.manage": { label: "Manage staff accounts", detail: "Invite staff, assign roles and deactivate accounts. Nobody can give a role with permissions they don't have themselves." },
  "roles.manage": { label: "Manage roles", detail: "Edit what each role can do and create custom roles, within the permissions you have yourself." },
  "audit.view": { label: "See the audit log", detail: "Who changed what and when, with old and new values, and its CSV export." },
};

export const PERMISSION_GROUPS: { group: string; permissions: Permission[] }[] = [
  { group: "Members", permissions: ["members.view", "members.view_sensitive", "members.edit"] },
  { group: "Classes and front desk", permissions: ["classes.manage", "bookings.manage", "checkin.scan"] },
  { group: "Shop", permissions: ["orders.manage", "products.edit"] },
  { group: "Money", permissions: ["prices.edit", "finance.view", "finance.export", "refunds.issue"] },
  { group: "Running the gym", permissions: ["plans.edit", "announcements.send", "settings.edit", "staff.manage", "roles.manage", "audit.view"] },
];

// Things only an owner can do, whatever permissions a role has. The first
// three are reserved: GymOS has no screen for them yet.
export const OWNER_ONLY_ACTIONS = [
  "Manage the gym's billing account with GymOS",
  "Change where payouts go",
  "Delete the gym's data",
  "Transfer ownership: give or take away the Owner role",
  "Edit the Owner role, or deactivate an owner",
] as const;

export const PRESETS = ["OWNER", "ADMIN", "MANAGER", "STAFF", "TRAINER"] as const;
export type Preset = (typeof PRESETS)[number];

// What each preset role starts with. Least privilege: Staff and Trainer don't
// see money or members' private details unless someone with roles.manage
// turns it on. Trainers also see their own classes and the members booked
// into them, without any permission (lib/auth/access.ts).
export const PRESET_ROLES: Record<Preset, { name: string; description: string; isOwner: boolean; permissions: readonly Permission[] }> = {
  OWNER: { name: "Owner", description: "Everything, including the owner-only actions.", isOwner: true, permissions: PERMISSIONS },
  ADMIN: { name: "Admin", description: "Everything except the owner-only actions.", isOwner: false, permissions: PERMISSIONS },
  MANAGER: {
    name: "Manager",
    description: "Runs the gym day to day and sees the money, but can't change prices, settings, plans, staff or roles.",
    isOwner: false,
    permissions: ["members.view", "members.view_sensitive", "members.edit", "classes.manage", "bookings.manage", "checkin.scan", "orders.manage", "products.edit", "refunds.issue", "announcements.send", "finance.view", "audit.view"],
  },
  STAFF: {
    name: "Front desk",
    description: "Checks members in, handles bookings and shop orders, and sees schedules and members. No prices, settings or money.",
    isOwner: false,
    permissions: ["members.view", "checkin.scan", "bookings.manage", "orders.manage"],
  },
  TRAINER: { name: "Trainer", description: "Their own classes and attendance, and only the member details those classes need.", isOwner: false, permissions: [] },
};

// The fixed roles before PR 6, and the preset each one became (D-098).
export const LEGACY_ROLE_PRESET = { OWNER: "OWNER", MANAGER: "MANAGER", FRONT_DESK: "STAFF", TRAINER: "TRAINER" } as const satisfies Record<string, Preset>;

// The access a signed-in staff member has, loaded from their role on every
// request. `permissions` is complete for owners.
export interface Access {
  isOwner: boolean;
  permissions: readonly Permission[];
}

export function can(access: Access | null | undefined, permission: Permission): boolean {
  if (!access) return false;
  return access.isOwner || access.permissions.includes(permission);
}

// What a route or screen needs: one permission, any of several, or null for
// any active staff member.
export type PermissionRule = Permission | readonly Permission[] | null;

export function allows(access: Access | null | undefined, rule: PermissionRule): boolean {
  if (!access) return false;
  if (rule === null) return true;
  return typeof rule === "string" ? can(access, rule) : rule.some((p) => can(access, p));
}

// Stock and equipment lists are for whoever handles orders and stock counts or
// edits products and equipment: Front desk, Manager, Admin and Owner by
// default, not Trainers (as before PR 6).
export const SEE_STOCK_AND_EQUIPMENT = ["orders.manage", "products.edit"] as const satisfies readonly Permission[];

// The permissions a role really grants: an owner role grants everything,
// whatever its stored list says.
export function effectivePermissions(role: { isOwner: boolean; permissions: readonly string[] }): Permission[] {
  return role.isOwner ? [...PERMISSIONS] : PERMISSIONS.filter((p) => role.permissions.includes(p));
}

// A staff member who can't see members, bookings or the timetable (a Trainer
// by default) only sees their own classes and the members booked into them
// (R-33, lib/auth/access.ts).
export function ownClassesOnly(access: Access | null | undefined): boolean {
  return !can(access, "members.view") && !can(access, "bookings.manage") && !can(access, "classes.manage");
}

// Whether someone may give a role to a person, or change it: only an owner
// for the Owner role, and otherwise only if they hold every permission the
// role grants. The server enforces this in lib/roles/service.ts; screens use
// it to offer only the roles that will be accepted.
export function canGrantRole(access: Access | null | undefined, role: { isOwner: boolean; permissions: readonly string[] }): boolean {
  if (!access) return false;
  if (access.isOwner) return true;
  return !role.isOwner && effectivePermissions(role).every((p) => access.permissions.includes(p));
}
