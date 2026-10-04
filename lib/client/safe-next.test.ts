import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("allows same-site paths under the prefix", () => {
    expect(safeNext("/shop/cart", "/member", "/")).toBe("/shop/cart");
    expect(safeNext("/member/classes", "/member", "/member")).toBe("/member/classes");
  });
  it("refuses other sites and paths outside the prefix", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", ""]) {
      expect(safeNext(bad, "/member", "/")).toBe("/member");
    }
    expect(safeNext("/admin", "/member", "/member")).toBe("/member");
    expect(safeNext(null, "/member", "/")).toBe("/member");
  });
});
