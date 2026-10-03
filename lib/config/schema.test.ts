import { describe, expect, it } from "vitest";
import rawConfig from "@/config/gym.config.json";
import { isValidAbn } from "./schema";
import { parseGymConfig } from "./index";

describe("isValidAbn", () => {
  it("accepts check-digit-valid ABNs with or without spaces", () => {
    expect(isValidAbn("94 687 093 963")).toBe(true);
    expect(isValidAbn("94687093963")).toBe(true);
  });
  it("rejects wrong lengths and bad check digits", () => {
    expect(isValidAbn("12 345 678 901")).toBe(false);
    expect(isValidAbn("1234")).toBe(false);
    expect(isValidAbn("94 687 093 964")).toBe(false);
  });
});

describe("gym config", () => {
  it("the shipped config is valid", () => {
    expect(() => parseGymConfig(rawConfig)).not.toThrow();
  });

  it("names every problem when the config is invalid", () => {
    const bad = structuredClone(rawConfig) as Record<string, unknown> & { business: Record<string, unknown>; policies: { dataRetention: { financialRecordsYears: number } } };
    bad.business.abn = "11 111 111 111";
    bad.business.timezone = "Mars/Olympus_Mons";
    bad.policies.dataRetention.financialRecordsYears = 2;
    expect(() => parseGymConfig(bad)).toThrow(/business\.abn[\s\S]*business\.timezone[\s\S]*financialRecordsYears/);
  });

  it("rejects duplicate plan slugs", () => {
    const bad = structuredClone(rawConfig);
    bad.plans.push({ ...bad.plans[0] });
    expect(() => parseGymConfig(bad)).toThrow(/slugs must be unique/);
  });
});
