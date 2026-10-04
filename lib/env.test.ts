import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  SESSION_SECRET: "x".repeat(32),
};

describe("environment validation", () => {
  it("accepts a minimal valid environment and fills defaults", () => {
    const env = parseServerEnv(base);
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it("rejects a short session secret without echoing its value", () => {
    try {
      parseServerEnv({ ...base, SESSION_SECRET: "hunter2" });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toMatch(/SESSION_SECRET/);
      expect(String(e)).not.toMatch(/hunter2/);
    }
  });

  it("refuses live Stripe keys unless explicitly allowed", () => {
    const live = { ...base, STRIPE_SECRET_KEY: "sk_live_" + "a".repeat(20) };
    expect(() => parseServerEnv(live)).toThrow(/live Stripe key/);
    expect(() => parseServerEnv({ ...live, STRIPE_ALLOW_LIVE_KEYS: "true" })).not.toThrow();
  });

  it("accepts test keys and treats blanks as unset", () => {
    const env = parseServerEnv({ ...base, STRIPE_SECRET_KEY: "sk_test_abc", CRON_SECRET: "" });
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_abc");
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it("rejects a malformed webhook secret and a non-postgres URL", () => {
    expect(() => parseServerEnv({ ...base, STRIPE_WEBHOOK_SECRET: "nope" })).toThrow(/whsec_/);
    expect(() => parseServerEnv({ ...base, DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });
});
