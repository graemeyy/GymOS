// D-124: nothing outside config and seed files may name the demo gym, so
// every copy of GymOS shows its own brand and none of the demo's. Branding
// lives in the database (the Branding page) with defaults in
// config/gym.config.json; the demo data lives in prisma/seed*.ts.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import rawConfig from "@/config/gym.config.json";

const ALLOWED = [/^config\//, /^prisma\/seed[^/]*\.ts$/];

// The demo gym's brand and business details, straight from the config, so
// this file doesn't name them either.
function brandTexts(): string[] {
  const { brand, business } = rawConfig;
  const emailDomain = business.email.split("@")[1];
  return [
    brand.name,
    brand.shortName,
    brand.tagline,
    business.legalName,
    business.abn,
    business.abn.replace(/\s+/g, ""),
    business.email,
    emailDomain,
    business.phone,
    business.address.line1,
    business.address.suburb,
  ].filter((t) => t.length >= 4);
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((f) => !ALLOWED.some((re) => re.test(f)));
}

describe("brand-specific text (D-124)", () => {
  it("only appears in config and seed files", () => {
    const needles = brandTexts().map((t) => t.toLowerCase());
    const found: string[] = [];
    for (const file of trackedFiles()) {
      let text: string;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (text.includes("\0")) continue; // images and other binary files
      const lower = text.toLowerCase();
      for (const needle of needles) {
        const at = lower.indexOf(needle);
        if (at >= 0) found.push(`${file}:${lower.slice(0, at).split("\n").length}: "${needle}"`);
      }
    }
    expect(found, "Read the value from the branding (getBranding or useBranding) or from config instead").toEqual([]);
  });

  it("checks the demo's name and details, so a renamed config can't make it pass by accident", () => {
    expect(brandTexts().length).toBeGreaterThanOrEqual(8);
  });
});
