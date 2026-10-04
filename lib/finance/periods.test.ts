import { describe, expect, it } from "vitest";
import { standardPeriods } from "./periods";

describe("Australian reporting periods (Sydney)", () => {
  it("finds the BAS quarter and financial year", () => {
    const periods = standardPeriods("Australia/Sydney", new Date("2026-11-15T01:00:00Z"));
    const byKey = Object.fromEntries(periods.map((p) => [p.key, p]));
    expect(byKey["this-quarter"].label).toBe("BAS quarter Oct to Dec 2026");
    expect(byKey["this-quarter"].from.toISOString()).toBe("2026-09-30T14:00:00.000Z"); // 1 Oct, AEST
    expect(byKey["this-quarter"].to.toISOString()).toBe("2026-12-31T13:00:00.000Z"); // 1 Jan, AEDT
    expect(byKey["financial-year"].label).toBe("Financial year 2026 to 27");
    expect(byKey["financial-year"].from.toISOString()).toBe("2026-06-30T14:00:00.000Z");
  });

  it("handles January (quarter Jan to Mar, FY started the previous July)", () => {
    const periods = standardPeriods("Australia/Sydney", new Date("2027-01-20T01:00:00Z"));
    const byKey = Object.fromEntries(periods.map((p) => [p.key, p]));
    expect(byKey["this-quarter"].label).toBe("BAS quarter Jan to Mar 2027");
    expect(byKey["last-month"].label).toBe("December 2026");
    expect(byKey["financial-year"].label).toBe("Financial year 2026 to 27");
  });
});
