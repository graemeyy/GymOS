import { describe, expect, it } from "vitest";
import { startOfTodayIn, zonedTimeToUtc } from "./dates";

describe("timezone helpers", () => {
  it("converts Sydney wall-clock time to UTC across daylight saving", () => {
    // AEST (UTC+10) in winter, AEDT (UTC+11) in summer.
    expect(zonedTimeToUtc("2026-07-01", "06:00", "Australia/Sydney").toISOString()).toBe("2026-06-30T20:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "06:00", "Australia/Sydney").toISOString()).toBe("2026-11-30T19:00:00.000Z");
  });

  it("handles Perth (no daylight saving)", () => {
    expect(zonedTimeToUtc("2026-12-01", "06:00", "Australia/Perth").toISOString()).toBe("2026-11-30T22:00:00.000Z");
  });

  it("finds local midnight", () => {
    const now = new Date("2026-10-03T03:30:00Z"); // 1:30pm in Sydney (AEST, before DST starts 4 Oct)
    expect(startOfTodayIn("Australia/Sydney", now).toISOString()).toBe("2026-10-02T14:00:00.000Z");
  });
});
