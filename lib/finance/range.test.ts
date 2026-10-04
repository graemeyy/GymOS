import { describe, expect, it } from "vitest";
import { resolveRange } from "./range";

describe("R-22 custom finance ranges", () => {
  it("end at the next local midnight on the day daylight saving starts", () => {
    // Sydney moves to AEDT at 2am on 4 October 2026, so that day is 23 hours long.
    const { from, to } = resolveRange({ from: "2026-10-01", to: "2026-10-04" });
    expect(from.toISOString()).toBe("2026-09-30T14:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-04T13:00:00.000Z");
  });

  it("end at the next local midnight on the day daylight saving ends", () => {
    // Back to AEST at 3am on 5 April 2026: a 25-hour day.
    const { to } = resolveRange({ from: "2026-04-01", to: "2026-04-05" });
    expect(to.toISOString()).toBe("2026-04-05T14:00:00.000Z");
  });
});
