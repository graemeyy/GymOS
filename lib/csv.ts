export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

// A cell starting with = + - @ (or a tab/return) can run as a formula in
// Excel and Sheets. Text like that gets a leading apostrophe; plain numbers
// such as "-12.50" are left alone so they stay numbers.
function neutraliseFormula(value: string): string {
  if (/^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value)) return `'${value}`;
  return value;
}

export function escapeCsvCell(raw: string): string {
  const value = neutraliseFormula(raw);
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(String(c.value(row) ?? ""))).join(",")
  );
  return [header, ...lines].join("\r\n");
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
