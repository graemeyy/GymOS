import { describe, it, expect } from "vitest";
import { hasRole, ROLE_LABELS } from "./roles";

describe("hasRole", () => {
  it("lets an OWNER through every minimum", () => {
    expect(hasRole("OWNER", "FRONT_DESK")).toBe(true);
    expect(hasRole("OWNER", "MANAGER")).toBe(true);
    expect(hasRole("OWNER", "OWNER")).toBe(true);
  });

  it("lets a MANAGER through MANAGER and FRONT_DESK minimums, but not OWNER", () => {
    expect(hasRole("MANAGER", "FRONT_DESK")).toBe(true);
    expect(hasRole("MANAGER", "MANAGER")).toBe(true);
    expect(hasRole("MANAGER", "OWNER")).toBe(false);
  });

  it("lets FRONT_DESK through only the FRONT_DESK minimum", () => {
    expect(hasRole("FRONT_DESK", "FRONT_DESK")).toBe(true);
    expect(hasRole("FRONT_DESK", "MANAGER")).toBe(false);
    expect(hasRole("FRONT_DESK", "OWNER")).toBe(false);
  });

  it("denies a missing or unrecognized role", () => {
    expect(hasRole(null, "FRONT_DESK")).toBe(false);
    expect(hasRole(undefined, "FRONT_DESK")).toBe(false);
  });
});

describe("ROLE_LABELS", () => {
  it("has a human label for every role", () => {
    expect(ROLE_LABELS.OWNER).toBe("Owner");
    expect(ROLE_LABELS.MANAGER).toBe("Manager");
    expect(ROLE_LABELS.FRONT_DESK).toBe("Front desk");
  });
});
