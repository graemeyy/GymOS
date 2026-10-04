import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, permissionsFor } from "./permissions";

describe("permissions", () => {
  it("owner has everything", () => {
    expect(permissionsFor("OWNER")).toEqual([...PERMISSIONS]);
  });

  it("manager has everything except staff, plans and gym settings", () => {
    expect(can("MANAGER", "billing:refund")).toBe(true);
    expect(can("MANAGER", "members:archive")).toBe(true);
    expect(can("MANAGER", "staff:manage")).toBe(false);
    expect(can("MANAGER", "plans:manage")).toBe(false);
    expect(can("MANAGER", "settings:manage")).toBe(false);
  });

  it("front desk can check in, book and add members, but not money admin", () => {
    for (const p of ["checkin:scan", "classes:book", "members:write", "inventory:adjust"] as const) expect(can("FRONT_DESK", p)).toBe(true);
    for (const p of ["billing:manage", "billing:refund", "finance:view", "members:archive", "staff:read", "audit:read", "classes:manage"] as const) {
      expect(can("FRONT_DESK", p)).toBe(false);
    }
  });

  it("front desk loses revenue when the owner hides it", () => {
    expect(can("FRONT_DESK", "revenue:view")).toBe(true);
    expect(can("FRONT_DESK", "revenue:view", { hideRevenueFromFrontDesk: true })).toBe(false);
    expect(can("MANAGER", "revenue:view", { hideRevenueFromFrontDesk: true })).toBe(true);
  });

  it("trainer can see classes and mark attendance only", () => {
    expect(permissionsFor("TRAINER")).toEqual(["dashboard:view", "members:read", "classes:read", "classes:attendance", "shifts:read"]);
  });

  it("denies unknown or missing roles", () => {
    expect(can(null, "dashboard:view")).toBe(false);
    expect(can("JANITOR" as never, "dashboard:view")).toBe(false);
  });
});
