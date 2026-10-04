import { describe, expect, it } from "vitest";
import { can, canGrantRole, effectivePermissions, isPermission, ownClassesOnly, PERMISSION_GROUPS, PERMISSION_INFO, PERMISSIONS, PRESET_ROLES, type Access, type Permission } from "./permissions";

const access = (permissions: readonly Permission[], isOwner = false): Access => ({ isOwner, permissions });
const preset = (name: keyof typeof PRESET_ROLES) => access(PRESET_ROLES[name].permissions, PRESET_ROLES[name].isOwner);

describe("the permission catalogue", () => {
  it("has the 18 permissions the brief lists", () => {
    expect([...PERMISSIONS].sort()).toEqual(
      ["prices.edit", "plans.edit", "products.edit", "settings.edit", "staff.manage", "roles.manage", "finance.view", "finance.export", "members.view", "members.view_sensitive", "members.edit", "refunds.issue", "classes.manage", "bookings.manage", "checkin.scan", "orders.manage", "announcements.send", "audit.view"].sort()
    );
  });

  it("describes every permission and puts each in exactly one group", () => {
    for (const p of PERMISSIONS) expect(PERMISSION_INFO[p].label.length).toBeGreaterThan(0);
    expect(PERMISSION_GROUPS.flatMap((g) => g.permissions).sort()).toEqual([...PERMISSIONS].sort());
  });

  it("recognises only real permission names", () => {
    expect(isPermission("prices.edit")).toBe(true);
    expect(isPermission("billing:refund")).toBe(false);
    expect(isPermission(undefined)).toBe(false);
  });
});

describe("preset roles", () => {
  it("Owner and Admin have every permission; only Owner is an owner", () => {
    expect(PRESET_ROLES.OWNER.permissions).toEqual(PERMISSIONS);
    expect(PRESET_ROLES.ADMIN.permissions).toEqual(PERMISSIONS);
    expect(PRESET_ROLES.OWNER.isOwner).toBe(true);
    expect(PRESET_ROLES.ADMIN.isOwner).toBe(false);
  });

  it("Manager runs operations and sees money, but can't change prices, settings, plans, staff or roles", () => {
    const m = preset("MANAGER");
    for (const p of ["members.view", "members.edit", "classes.manage", "bookings.manage", "checkin.scan", "orders.manage", "refunds.issue", "finance.view"] as const) expect(can(m, p)).toBe(true);
    for (const p of ["prices.edit", "settings.edit", "plans.edit", "staff.manage", "roles.manage", "finance.export"] as const) expect(can(m, p)).toBe(false);
  });

  it("Front desk checks in, books, handles orders and sees members, with no money, prices or settings", () => {
    const s = preset("STAFF");
    expect([...PRESET_ROLES.STAFF.permissions].sort()).toEqual(["bookings.manage", "checkin.scan", "members.view", "orders.manage"]);
    for (const p of ["finance.view", "members.view_sensitive", "prices.edit", "settings.edit", "members.edit"] as const) expect(can(s, p)).toBe(false);
  });

  it("Trainer has no permissions; their own classes come from record-level access", () => {
    expect(PRESET_ROLES.TRAINER.permissions).toEqual([]);
    expect(ownClassesOnly(preset("TRAINER"))).toBe(true);
  });

  it("least privilege: Staff and Trainer don't see money or private member details", () => {
    for (const r of ["STAFF", "TRAINER"] as const) {
      expect(can(preset(r), "finance.view")).toBe(false);
      expect(can(preset(r), "members.view_sensitive")).toBe(false);
    }
  });
});

describe("can", () => {
  it("allows what the role lists and nothing else", () => {
    expect(can(access(["checkin.scan"]), "checkin.scan")).toBe(true);
    expect(can(access(["checkin.scan"]), "finance.view")).toBe(false);
  });

  it("an owner can do everything, whatever the stored list says", () => {
    expect(can(access([], true), "roles.manage")).toBe(true);
    expect(effectivePermissions({ isOwner: true, permissions: [] })).toEqual([...PERMISSIONS]);
  });

  it("drops unknown names from a stored list", () => {
    expect(effectivePermissions({ isOwner: false, permissions: ["members.view", "billing:refund"] })).toEqual(["members.view"]);
  });

  it("denies a missing session", () => {
    expect(can(null, "members.view")).toBe(false);
    expect(can(undefined, "members.view")).toBe(false);
  });
});

describe("ownClassesOnly", () => {
  it("limits only staff who can't see members, bookings or the timetable", () => {
    expect(ownClassesOnly(access([]))).toBe(true);
    expect(ownClassesOnly(access(["checkin.scan"]))).toBe(true);
    expect(ownClassesOnly(access(["members.view"]))).toBe(false);
    expect(ownClassesOnly(access(["bookings.manage"]))).toBe(false);
    expect(ownClassesOnly(access(["classes.manage"]))).toBe(false);
    expect(ownClassesOnly(access([], true))).toBe(false);
  });
});

describe("canGrantRole", () => {
  const front = { isOwner: false, permissions: ["members.view", "checkin.scan"] };
  const owner = { isOwner: true, permissions: [] };

  it("an owner can give any role, including Owner", () => {
    expect(canGrantRole(access([], true), owner)).toBe(true);
    expect(canGrantRole(access([], true), front)).toBe(true);
  });

  it("nobody else can give the Owner role, even with every permission", () => {
    expect(canGrantRole(preset("ADMIN"), owner)).toBe(false);
  });

  it("a role is only grantable if it's within the giver's own permissions", () => {
    expect(canGrantRole(access(["members.view", "checkin.scan", "staff.manage"]), front)).toBe(true);
    expect(canGrantRole(access(["members.view", "staff.manage"]), front)).toBe(false);
    expect(canGrantRole(null, front)).toBe(false);
  });
});
