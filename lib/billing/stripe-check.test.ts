import { execFileSync } from "child_process";
import { describe, expect, it } from "vitest";
import { checkEndpoints, checkStripeEnv, requiredEvents, siteUrl } from "./stripe-check";
import { STRIPE_WEBHOOK_EVENTS } from "./events";

const VERSION = "2023-10-16";
const levels = (f: { level: string }[]) => f.map((x) => x.level);

describe("checkStripeEnv (D-117)", () => {
  it("passes test-mode keys and a webhook secret", () => {
    const f = checkStripeEnv({ STRIPE_SECRET_KEY: "sk_test_abc123", STRIPE_WEBHOOK_SECRET: "whsec_abc" }, VERSION);
    expect(levels(f)).toEqual(["ok", "ok", "note"]);
  });

  it("accepts a restricted test key", () => {
    expect(checkStripeEnv({ STRIPE_SECRET_KEY: "rk_test_abc", STRIPE_WEBHOOK_SECRET: "whsec_abc" }, VERSION)[0].message).toMatch(/restricted/);
  });

  it("fails live keys, missing values and things that aren't Stripe keys", () => {
    expect(checkStripeEnv({ STRIPE_SECRET_KEY: "sk_live_abc", STRIPE_WEBHOOK_SECRET: "whsec_abc" }, VERSION)[0]).toMatchObject({ level: "fail", message: expect.stringMatching(/LIVE/) });
    expect(levels(checkStripeEnv({}, VERSION)).slice(0, 2)).toEqual(["fail", "fail"]);
    expect(levels(checkStripeEnv({ STRIPE_SECRET_KEY: "pk_test_abc", STRIPE_WEBHOOK_SECRET: "abc" }, VERSION)).slice(0, 2)).toEqual(["fail", "fail"]);
  });

  it("warns when live keys are allowed", () => {
    expect(checkStripeEnv({ STRIPE_SECRET_KEY: "sk_test_a", STRIPE_WEBHOOK_SECRET: "whsec_a", STRIPE_ALLOW_LIVE_KEYS: "true" }, VERSION).map((f) => f.level)).toContain("warn");
  });

  it("never repeats a key or secret in its messages", () => {
    const env = { STRIPE_SECRET_KEY: "sk_live_SUPERSECRET123", STRIPE_WEBHOOK_SECRET: "whsec_SUPERSECRET456" };
    const text = JSON.stringify(checkStripeEnv(env, VERSION));
    expect(text).not.toContain("SUPERSECRET");
  });
});

describe("the script", () => {
  it("never prints the key, and fails with a live key", () => {
    let out = "";
    let code = 0;
    try {
      execFileSync("npx", ["tsx", "--conditions=react-server", "scripts/stripe-check.ts"], {
        env: { ...process.env, STRIPE_SECRET_KEY: "sk_live_DONOTPRINT987", STRIPE_WEBHOOK_SECRET: "whsec_DONOTPRINT654" },
        encoding: "utf8",
      });
    } catch (error) {
      const e = error as { stdout: string; stderr: string; status: number };
      out = e.stdout + e.stderr;
      code = e.status;
    }
    expect(code).toBe(1);
    expect(out).toContain("LIVE key");
    expect(out).not.toContain("DONOTPRINT");
  }, 30_000);
});

describe("requiredEvents", () => {
  it("lists every handled event with a purpose", () => {
    expect(requiredEvents()).toHaveLength(STRIPE_WEBHOOK_EVENTS.length);
    expect(requiredEvents().every((l) => /^[a-z._]+: .+/.test(l))).toBe(true);
  });
});

describe("checkEndpoints (--remote)", () => {
  const url = "https://gym.example.com/api/webhooks/stripe";
  const endpoint = { url, status: "enabled", enabled_events: [...STRIPE_WEBHOOK_EVENTS], api_version: VERSION, livemode: false };

  it("passes an enabled test endpoint that sends everything at the right version", () => {
    expect(levels(checkEndpoints([endpoint], url, VERSION))).toEqual(["ok"]);
    expect(levels(checkEndpoints([{ ...endpoint, enabled_events: ["*"] }], url, VERSION))).toEqual(["ok"]);
  });

  it("accepts either name for the same change", () => {
    const events = STRIPE_WEBHOOK_EVENTS.filter((e) => e !== "refund.updated" && e !== "invoice.payment_succeeded");
    expect(levels(checkEndpoints([{ ...endpoint, enabled_events: events }], url, VERSION))).toEqual(["ok"]);
  });

  it("names missing events, a wrong version, a disabled or live endpoint, or none at all", () => {
    const f = checkEndpoints([{ ...endpoint, enabled_events: ["checkout.session.completed"], api_version: "2024-06-20", status: "disabled", livemode: true }], url, VERSION);
    expect(levels(f)).toEqual(["fail", "fail", "fail", "fail"]);
    expect(f.map((x) => x.message).join(" ")).toMatch(/charge\.refunded/);
    expect(checkEndpoints([], url, VERSION)[0]).toMatchObject({ level: "fail", message: expect.stringMatching(/No test-mode webhook endpoint/) });
  });
});

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL, then Vercel's addresses, then localhost", () => {
    expect(siteUrl({ NEXT_PUBLIC_APP_URL: "https://gym.example.com/" })).toBe("https://gym.example.com");
    expect(siteUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "gym.example.com", VERCEL_URL: "x.vercel.app" })).toBe("https://gym.example.com");
    expect(siteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "x.vercel.app" })).toBe("https://x.vercel.app");
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
});
