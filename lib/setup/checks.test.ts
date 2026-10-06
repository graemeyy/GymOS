import { describe, expect, it } from "vitest";
import rawConfig from "@/config/gym.config.json";
import { parseGymConfig } from "@/lib/config";
import { checkConfig, checkEnvironment, checkSetupToken, formatFindings } from "./checks";

const SECRETS = {
  DATABASE_URL: "postgresql://gym:Sup3rS3cretPw@db.internal.example-host.net:5432/gym_prod",
  SESSION_SECRET: "q8ZtV1mK4pX7rN2sL9wE3yH6jB0cF5gA-session-secret",
  NEXT_PUBLIC_APP_URL: "https://members.harbourlift.com.au",
  STRIPE_SECRET_KEY: "sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
  STRIPE_WEBHOOK_SECRET: "whsec_9f8e7d6c5b4a3210fedcba9876543210",
  RESEND_API_KEY: "re_AbC123dEf456GhI789jKl",
  EMAIL_FROM: "Harbour Lift <hello@harbourlift.com.au>",
  CRON_SECRET: "cron-0123456789abcdef-secret",
  IOT_GATEWAY_SECRET: "door-0123456789abcdef-secret",
  SETUP_TOKEN: "setup-0123456789abcdef-token",
  VERCEL_ENV: "production",
};

const levels = (findings: { level: string; area: string }[]) => findings.map((f) => `${f.area}:${f.level}`);

describe("setup check (D-132)", () => {
  it("passes a complete production environment and never prints a value", () => {
    const findings = [...checkEnvironment(SECRETS), ...checkSetupToken(SECRETS, false)];
    expect(findings.filter((f) => f.level === "fail")).toEqual([]);
    const report = formatFindings(findings);
    for (const [name, value] of Object.entries(SECRETS)) {
      if (name === "VERCEL_ENV" || name === "NEXT_PUBLIC_APP_URL" || name === "EMAIL_FROM") continue;
      expect(report).not.toContain(value);
      // Not even part of one.
      expect(report).not.toContain(value.slice(-12));
    }
    expect(report).not.toContain("Sup3rS3cretPw");
    expect(report).not.toContain("db.internal");
    // The email domain is shown (it has to be verified), not the whole address.
    expect(report).toContain("harbourlift.com.au domain");
  });

  it("reports each missing or placeholder setting", () => {
    const findings = checkEnvironment({ VERCEL_ENV: "production", SESSION_SECRET: "replace-with-a-long-random-string-at-least-32-chars", EMAIL_FROM: '"Your Gym <hello@yourgym.example>"', SHOW_EMAIL_LINKS: "true" });
    expect(levels(findings)).toEqual(
      expect.arrayContaining(["Database:fail", "Security:fail", "Domain:warn", "Stripe:fail", "Email:fail", "Daily job:fail", "Doors:note"])
    );
    expect(findings.find((f) => f.message.startsWith("SESSION_SECRET"))?.message).toMatch(/placeholder/);
    expect(findings.some((f) => f.message.startsWith("SHOW_EMAIL_LINKS"))).toBe(true);
    expect(findings.find((f) => f.message.startsWith("EMAIL_FROM"))?.message).toMatch(/placeholder/);
  });

  it("refuses a live key unless live keys are allowed", () => {
    const live = { ...SECRETS, STRIPE_SECRET_KEY: "sk_live_51AbCdEfGh" };
    expect(checkEnvironment(live).find((f) => f.message.startsWith("STRIPE_SECRET_KEY"))?.level).toBe("fail");
    expect(checkEnvironment({ ...live, STRIPE_ALLOW_LIVE_KEYS: "true" }).find((f) => f.message.startsWith("STRIPE_SECRET_KEY"))?.level).toBe("ok");
  });

  it("needs SETUP_TOKEN only until there's an owner", () => {
    expect(checkSetupToken({}, false)[0].level).toBe("fail");
    expect(checkSetupToken({}, true)[0].level).toBe("ok");
    expect(checkSetupToken({ SETUP_TOKEN: SECRETS.SETUP_TOKEN }, true)[0].message).toMatch(/no longer needed/);
  });

  it("flags the shipped demo config", () => {
    const demo = parseGymConfig(rawConfig);
    expect(checkConfig(demo).map((f) => f.level)).toContain("fail");
    const real = parseGymConfig({ ...rawConfig, isDemo: false, business: { ...rawConfig.business, email: "hello@harbourlift.com.au" } });
    expect(checkConfig(real).filter((f) => f.level === "fail")).toEqual([]);
  });
});
