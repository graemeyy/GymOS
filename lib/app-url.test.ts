import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "./env";
import { appUrl, resolveAppUrl } from "./app-url";

const none = { NEXT_PUBLIC_APP_URL: undefined, VERCEL_ENV: undefined, VERCEL_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined };

describe("resolveAppUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL when it's set, without a trailing slash", () => {
    expect(resolveAppUrl({ ...none, NEXT_PUBLIC_APP_URL: "https://gym.example.com/", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "gym-os.vercel.app" })).toBe("https://gym.example.com");
  });

  it("uses the production domain on a Vercel production deployment", () => {
    expect(resolveAppUrl({ ...none, VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "gym.example.com", VERCEL_URL: "gym-os-abc123.vercel.app" })).toBe("https://gym.example.com");
  });

  it("uses the deployment's own address on a preview", () => {
    expect(resolveAppUrl({ ...none, VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "gym.example.com", VERCEL_URL: "gym-os-git-feature.vercel.app" })).toBe("https://gym-os-git-feature.vercel.app");
  });

  it("falls back to the deployment address on production if the production domain is missing", () => {
    expect(resolveAppUrl({ ...none, VERCEL_ENV: "production", VERCEL_URL: "gym-os-abc123.vercel.app" })).toBe("https://gym-os-abc123.vercel.app");
  });

  it("uses localhost anywhere else", () => {
    expect(resolveAppUrl(none)).toBe("http://localhost:3000");
  });
});

describe("appUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });

  it("joins a path onto the base", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "gym-os-git-x.vercel.app");
    resetEnvCacheForTests();
    expect(appUrl("/admin/invite?token=abc")).toBe("https://gym-os-git-x.vercel.app/admin/invite?token=abc");
    expect(appUrl("member")).toBe("https://gym-os-git-x.vercel.app/member");
    expect(appUrl()).toBe("https://gym-os-git-x.vercel.app");
  });
});

// Every link the app writes goes through appUrl(), so the fallback applies
// everywhere (D-109).
describe("one helper for links", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });

  it("nothing outside lib/app-url.ts and lib/env.ts reads NEXT_PUBLIC_APP_URL", () => {
    const offenders = ["lib", "app", "components"]
      .flatMap((dir) => files(join(process.cwd(), dir)))
      .filter((f) => !f.endsWith(join("lib", "app-url.ts")) && !f.endsWith(join("lib", "env.ts")))
      .filter((f) => readFileSync(f, "utf8").includes("NEXT_PUBLIC_APP_URL"));
    expect(offenders).toEqual([]);
  });
});
