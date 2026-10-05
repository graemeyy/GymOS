import { describe, expect, it } from "vitest";
import { demoPassword } from "./seed";

// D-110: no shared demo password in the repository.
describe("demo password", () => {
  it("uses SEED_DEMO_PASSWORD when it's set", () => {
    expect(demoPassword("my-own-demo-password")).toEqual({ password: "my-own-demo-password", generated: false });
  });

  it("refuses a short one", () => {
    expect(() => demoPassword("short")).toThrow(/at least 10/);
  });

  it("otherwise makes a new random one each time", () => {
    const a = demoPassword(undefined);
    const b = demoPassword(undefined);
    expect(a.generated).toBe(true);
    expect(a.password.length).toBeGreaterThanOrEqual(20);
    expect(a.password).not.toBe(b.password);
  });
});
