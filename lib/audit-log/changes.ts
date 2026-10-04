// The fields an audit entry changed, for the audit page. Values are compared
// as JSON, so nested values (a product's variants) count as one field.
export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function auditChanges(before: unknown, after: unknown): FieldChange[] {
  const b = isRecord(before) ? before : {};
  const a = isRecord(after) ? after : {};
  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return fields.filter((f) => JSON.stringify(b[f]) !== JSON.stringify(a[f])).map((field) => ({ field, before: b[field], after: a[field] }));
}

export function formatAuditValue(value: unknown): string {
  if (value === undefined) return "(none)";
  if (value === null) return "(empty)";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
