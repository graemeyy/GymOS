import { describe, expect, it } from "vitest";
import { retentionScore } from "./retention";

const now = new Date("2026-10-03T00:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe("retentionScore", () => {
  it("is 100 for a frequent, recent visitor", () => {
    expect(retentionScore({ lastCheckIn: ago(1), visitsLast30Days: 14, noShowsLast30Days: 0 }, now)).toBe(100);
  });
  it("is 0 for someone who never comes", () => {
    expect(retentionScore({ lastCheckIn: null, visitsLast30Days: 0, noShowsLast30Days: 0 }, now)).toBe(0);
  });
  it("takes off 5 per no-show, capped at 20, never below 0", () => {
    expect(retentionScore({ lastCheckIn: ago(1), visitsLast30Days: 14, noShowsLast30Days: 2 }, now)).toBe(90);
    expect(retentionScore({ lastCheckIn: ago(1), visitsLast30Days: 14, noShowsLast30Days: 10 }, now)).toBe(80);
    expect(retentionScore({ lastCheckIn: ago(20), visitsLast30Days: 1, noShowsLast30Days: 3 }, now)).toBe(0);
  });
});
