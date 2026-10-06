import { describe, expect, it } from "vitest";
import { parseClassCredits, parseCount, parseDate, parseInterval, parseMoney, parseStatus } from "./values";

describe("import values", () => {
  it("reads ISO and Australian (day-first) dates, and refuses impossible ones", () => {
    expect(parseDate("2024-03-01")).toBe("2024-03-01");
    expect(parseDate("2024-03-01T09:30:00Z")).toBe("2024-03-01");
    expect(parseDate("1/3/2024")).toBe("2024-03-01");
    expect(parseDate("01-03-24")).toBe("2024-03-01");
    expect(parseDate("31/02/2024")).toBeNull();
    expect(parseDate("March 1")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("reads prices in dollars", () => {
    expect(parseMoney("29.95")).toBe(2995);
    expect(parseMoney("$29.9")).toBe(2990);
    expect(parseMoney("1,200")).toBe(120000);
    expect(parseMoney("29")).toBe(2900);
    expect(parseMoney("29.999")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("free")).toBeNull();
  });

  it("reads billing intervals the way systems write them", () => {
    expect(parseInterval("Monthly")).toBe("MONTH");
    expect(parseInterval("per week")).toBe("WEEK");
    expect(parseInterval("fortnightly")).toBe("FORTNIGHT");
    expect(parseInterval("Annual")).toBe("YEAR");
    expect(parseInterval("daily")).toBeNull();
  });

  it("reads counts, class credits and statuses", () => {
    expect(parseCount("", 100)).toBe(0);
    expect(parseCount("12", 100)).toBe(12);
    expect(parseCount("101", 100)).toBeNull();
    expect(parseCount("2.5", 100)).toBeNull();
    expect(parseClassCredits("Unlimited")).toBeNull();
    expect(parseClassCredits("8")).toBe(8);
    expect(parseClassCredits("lots")).toBe("invalid");
    expect(parseStatus("")).toBe("ACTIVE");
    expect(parseStatus("On hold")).toBe("PAUSED");
    expect(parseStatus("cancelled")).toBeNull();
  });
});
