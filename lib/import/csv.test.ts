import { describe, expect, it } from "vitest";
import { CsvError, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads headers and rows with their line numbers", () => {
    const parsed = parseCsv("Name,Email\nAsha,asha@example.com\nBen,ben@example.com\n");
    expect(parsed.headers).toEqual(["Name", "Email"]);
    expect(parsed.rows).toEqual([
      { line: 2, cells: ["Asha", "asha@example.com"] },
      { line: 3, cells: ["Ben", "ben@example.com"] },
    ]);
  });

  it("handles quotes, commas and line breaks inside quoted values, CRLF and a byte-order mark", () => {
    const parsed = parseCsv('﻿Name,Notes\r\n"Lee, Sam","Said ""hi""\nthen left"\r\nKim,  plain  \r\n');
    expect(parsed.headers).toEqual(["Name", "Notes"]);
    expect(parsed.rows[0]).toEqual({ line: 2, cells: ["Lee, Sam", 'Said "hi"\nthen left'] });
    // The next record starts after the line break inside the quotes.
    expect(parsed.rows[1]).toEqual({ line: 4, cells: ["Kim", "plain"] });
  });

  it("skips blank lines and reads semicolon-separated files", () => {
    const parsed = parseCsv("Name;Price\n\nUnlimited;39,95\n\n");
    expect(parsed.headers).toEqual(["Name", "Price"]);
    expect(parsed.rows).toEqual([{ line: 3, cells: ["Unlimited", "39,95"] }]);
  });

  it("explains files it can't read", () => {
    expect(() => parseCsv("")).toThrow(CsvError);
    expect(() => parseCsv("\n\n")).toThrow("The file is empty.");
    expect(() => parseCsv('Name\n"Never closed')).toThrow("line 2");
  });
});
