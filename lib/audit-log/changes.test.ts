import { describe, expect, it } from "vitest";
import { auditChanges, formatAuditValue } from "./changes";

describe("auditChanges", () => {
  it("lists only the fields whose values differ", () => {
    expect(auditChanges({ name: "Gold", priceCents: 5000, active: true }, { name: "Gold", priceCents: 5500, active: true })).toEqual([{ field: "priceCents", before: 5000, after: 5500 }]);
  });

  it("compares nested values as a whole and keeps fields only one side has", () => {
    expect(auditChanges({ variants: [{ sku: "A", priceCents: 1 }] }, { variants: [{ sku: "A", priceCents: 2 }], extra: 1 })).toEqual([
      { field: "variants", before: [{ sku: "A", priceCents: 1 }], after: [{ sku: "A", priceCents: 2 }] },
      { field: "extra", before: undefined, after: 1 },
    ]);
  });

  it("treats a missing side as empty", () => {
    expect(auditChanges(null, { name: "New" })).toEqual([{ field: "name", before: undefined, after: "New" }]);
    expect(auditChanges(undefined, undefined)).toEqual([]);
  });
});

describe("formatAuditValue", () => {
  it("shows strings as they are and everything else as JSON", () => {
    expect(formatAuditValue("Front desk")).toBe("Front desk");
    expect(formatAuditValue(["members.view"])).toBe('["members.view"]');
    expect(formatAuditValue(null)).toBe("(empty)");
    expect(formatAuditValue(undefined)).toBe("(none)");
  });
});
