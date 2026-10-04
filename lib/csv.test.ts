import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "./csv";

describe("CSV", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell('Smith, "Jo"')).toBe('"Smith, ""Jo"""');
    expect(escapeCsvCell("two\nlines")).toBe('"two\nlines"');
  });

  it("neutralises spreadsheet formulas in text", () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil")')).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(escapeCsvCell("+61 400 000 000")).toBe("'+61 400 000 000");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("leaves numbers, including negatives, alone", () => {
    expect(escapeCsvCell("-12.50")).toBe("-12.50");
    expect(escapeCsvCell("29.95")).toBe("29.95");
  });

  it("builds rows with CRLF line endings", () => {
    expect(toCsv([{ a: 1, b: "x" }], [{ header: "A", value: (r) => r.a }, { header: "B", value: (r) => r.b }])).toBe("A,B\r\n1,x");
  });
});
