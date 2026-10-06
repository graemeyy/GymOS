// Reads CSV text (RFC 4180, as Excel, Numbers, Sheets and most gym systems
// export it): commas, double-quoted fields with "" for a quote, CRLF or LF
// line ends, a leading byte-order mark. Semicolon-separated files (some
// European exports) are recognised from the header row. No imports, so the
// browser can use it too.

export interface ParsedCsv {
  headers: string[];
  /** Data rows with their line number in the file (the header is line 1). */
  rows: { line: number; cells: string[] }[];
}

export class CsvError extends Error {}

function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let i = 0;
  // A field that was quoted keeps its spaces; others are trimmed.
  let wasQuoted = false;

  const endField = () => {
    cells.push(wasQuoted ? field : field.trim());
    field = "";
    wasQuoted = false;
  };
  const endRecord = () => {
    endField();
    records.push({ line: recordLine, cells });
    cells = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      if (ch === "\n") line++;
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === "") {
      quoted = true;
      wasQuoted = true;
      field = "";
      i++;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRecord();
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line++;
      recordLine = line;
      continue;
    }
    field += ch;
    i++;
  }
  if (quoted) throw new CsvError(`A quoted value that starts on line ${recordLine} is never closed.`);
  if (field !== "" || cells.length > 0) endRecord();

  // Blank lines (including the usual one at the end) aren't rows.
  const nonBlank = records.filter((r) => r.cells.some((c) => c !== ""));
  if (nonBlank.length === 0) throw new CsvError("The file is empty.");
  const [header, ...rows] = nonBlank;
  const headers = header.cells.map((h) => h.trim());
  if (headers.every((h) => h === "")) throw new CsvError("The first row should name the columns.");
  return { headers, rows };
}
