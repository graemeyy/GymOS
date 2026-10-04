import { describe, expect, it } from "vitest";
import { addInterval, currentCycle } from "./cycle";
import { prorationCents } from "./proration";
import { cancellationTerms, validatePause } from "./service";
import { ApiError } from "@/lib/http/errors";

const d = (s: string) => new Date(s);

describe("billing cycles", () => {
  it("adds weeks, fortnights, months (clamped) and years", () => {
    expect(addInterval(d("2026-01-01T00:00:00Z"), "WEEK").toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(addInterval(d("2026-01-01T00:00:00Z"), "FORTNIGHT").toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(addInterval(d("2026-01-31T00:00:00Z"), "MONTH").toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addInterval(d("2028-01-31T00:00:00Z"), "MONTH").toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(addInterval(d("2026-03-15T00:00:00Z"), "YEAR").toISOString()).toBe("2027-03-15T00:00:00.000Z");
  });

  it("uses Stripe's period when it covers now, otherwise rolls from the join date", () => {
    const now = d("2026-10-03T00:00:00Z");
    expect(currentCycle({ createdAt: d("2026-01-01T00:00:00Z"), currentPeriodStart: d("2026-10-01T00:00:00Z"), currentPeriodEnd: d("2026-10-08T00:00:00Z") }, "WEEK", now)).toEqual({
      start: d("2026-10-01T00:00:00Z"),
      end: d("2026-10-08T00:00:00Z"),
    });
    const rolled = currentCycle({ createdAt: d("2026-09-17T00:00:00Z"), currentPeriodStart: null, currentPeriodEnd: null }, "WEEK", now);
    expect(rolled).toEqual({ start: d("2026-10-01T00:00:00Z"), end: d("2026-10-08T00:00:00Z") });
  });
});

describe("proration", () => {
  it("charges the price difference for the rest of the cycle", () => {
    const start = d("2026-10-01T00:00:00Z");
    const end = d("2026-10-08T00:00:00Z");
    expect(prorationCents(2995, 3995, start, end, d("2026-10-01T00:00:00Z"))).toBe(1000);
    expect(prorationCents(2995, 3995, start, end, d("2026-10-04T12:00:00Z"))).toBe(500);
    expect(prorationCents(3995, 2995, start, end, d("2026-10-04T12:00:00Z"))).toBe(-500);
    expect(prorationCents(2995, 3995, start, end, d("2026-10-09T00:00:00Z"))).toBe(0);
  });
});

describe("cancellation rules (from config: 14 days notice, 7-day cooling-off, no minimum term)", () => {
  const now = d("2026-10-03T00:00:00Z");
  it("is immediate inside the cooling-off period", () => {
    const t = cancellationTerms(d("2026-09-30T00:00:00Z"), {}, undefined, now);
    expect(t).toMatchObject({ reason: "cooling_off", withinCoolingOff: true });
    expect(t.effectiveAt).toEqual(now);
  });
  it("takes effect after the notice period otherwise", () => {
    const t = cancellationTerms(d("2026-01-01T00:00:00Z"), {}, undefined, now);
    expect(t.reason).toBe("notice");
    expect(t.effectiveAt.toISOString()).toBe("2026-10-17T00:00:00.000Z");
  });
  it("respects a minimum term when it ends later than the notice", () => {
    const policy = { noticeDays: 14, minimumTermWeeks: 12, coolingOffDays: 0, allowMemberSelfCancel: true };
    const t = cancellationTerms(d("2026-09-01T00:00:00Z"), {}, policy, now);
    expect(t.reason).toBe("minimum_term");
    expect(t.effectiveAt.toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });
  it("staff can make it immediate", () => {
    expect(cancellationTerms(d("2026-01-01T00:00:00Z"), { immediate: true }, undefined, now).effectiveAt).toEqual(now);
  });
});

describe("pause rules (from config: 7 to 90 days, 2 a year)", () => {
  const now = d("2026-10-03T00:00:00Z");
  const from = d("2026-10-03T00:00:00Z");
  it("accepts a valid pause", () => {
    expect(validatePause({ from, until: d("2026-10-17T00:00:00Z"), pausesThisYear: 0, byMember: false }, undefined, now)).toBe(14);
  });
  it.each([
    [d("2026-10-05T00:00:00Z"), 0, /at least 7 days/],
    [d("2027-02-01T00:00:00Z"), 0, /at most 90 days/],
    [d("2026-10-17T00:00:00Z"), 2, /limit of 2 pauses/],
  ])("rejects until %s with %i previous pauses", (until, pauses, msg) => {
    expect(() => validatePause({ from, until, pausesThisYear: pauses, byMember: false }, undefined, now)).toThrow(msg);
  });
  it("blocks members when self-pause is off", () => {
    const policy = { allowMemberSelfPause: false, minDays: 7, maxDays: 90, maxPausesPerYear: 2, feeCents: 0 };
    expect(() => validatePause({ from, until: d("2026-10-17T00:00:00Z"), pausesThisYear: 0, byMember: true }, policy, now)).toThrow(ApiError);
  });
});
