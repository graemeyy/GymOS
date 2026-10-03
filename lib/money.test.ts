import { describe, expect, it } from "vitest";
import { applyDiscount, formatAud, gstFromInclusive, monthlyEquivalentCents, parseDollarsToCents, splitInclusive } from "./money";

describe("GST from GST-inclusive prices", () => {
  it("is one eleventh of the inclusive price", () => {
    expect(gstFromInclusive(1100)).toBe(100);
    expect(gstFromInclusive(11000)).toBe(1000);
  });

  it("rounds to the nearest cent", () => {
    expect(gstFromInclusive(2995)).toBe(272); // 272.27
    expect(gstFromInclusive(3995)).toBe(363); // 363.18
    expect(gstFromInclusive(1995)).toBe(181); // 181.36
    expect(gstFromInclusive(5)).toBe(0); // 0.45
    expect(gstFromInclusive(6)).toBe(1); // 0.55
  });

  it("is zero when the business isn't registered for GST", () => {
    expect(gstFromInclusive(2995, false)).toBe(0);
  });

  it("splits into exclusive + GST that add back up exactly", () => {
    for (const cents of [1, 99, 1995, 2995, 3995, 12345, 100000]) {
      const s = splitInclusive(cents);
      expect(s.exclusive + s.gst).toBe(cents);
    }
  });

  it("rejects fractional or negative cents", () => {
    expect(() => gstFromInclusive(10.5)).toThrow(RangeError);
    expect(() => gstFromInclusive(-1)).toThrow(RangeError);
  });
});

describe("formatAud", () => {
  it("formats Australian dollars", () => {
    expect(formatAud(2995)).toBe("$29.95");
    expect(formatAud(123456)).toBe("$1,234.56");
    expect(formatAud(19900, { whole: true })).toBe("$199");
  });
});

describe("parseDollarsToCents", () => {
  it.each([
    ["29.95", 2995],
    ["$29.95", 2995],
    ["30", 3000],
    ["1,250.5", 125050],
    ["0.07", 7],
  ])("parses %s", (input, cents) => expect(parseDollarsToCents(input)).toBe(cents));

  it.each(["", "abc", "-5", "1.234", "1.2.3"])("rejects %s", (input) => expect(parseDollarsToCents(input)).toBeNull());
});

describe("applyDiscount", () => {
  it("applies a percentage and rounds to the cent", () => {
    expect(applyDiscount(4995, 10)).toBe(4496);
    expect(applyDiscount(4995, 0)).toBe(4995);
    expect(applyDiscount(4995, 100)).toBe(0);
  });
  it("refuses out-of-range discounts", () => {
    expect(() => applyDiscount(1000, 101)).toThrow(RangeError);
  });
});

describe("monthlyEquivalentCents", () => {
  it("converts billing intervals to a monthly figure", () => {
    expect(monthlyEquivalentCents(1200, "WEEK")).toBe(5200);
    expect(monthlyEquivalentCents(2400, "FORTNIGHT")).toBe(5200);
    expect(monthlyEquivalentCents(5000, "MONTH")).toBe(5000);
    expect(monthlyEquivalentCents(60000, "YEAR")).toBe(5000);
  });
});
