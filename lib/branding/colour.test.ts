import { describe, expect, it } from "vitest";
import { brandStylesheet, contrast, contrastChecks, generateTokens, hexToRgb, rgbToHex } from "./colour";

describe("brand colours to design tokens (D-124)", () => {
  it("keep the shipped palette when given the shipped colours", () => {
    const { light, dark } = generateTokens("#1F5AA6", "#F2C230");
    expect(light.plate).toEqual([31, 90, 166]);
    expect(light.plateInk).toEqual([255, 255, 255]);
    // Within a few steps of the hand-tuned values in app/globals.css.
    const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= 12);
    expect(near(light.plateHover, [24, 72, 135])).toBe(true);
    expect(near(light.plateTint, [222, 232, 246])).toBe(true);
    expect(near(dark.plate, [127, 170, 240])).toBe(true);
    expect(dark.plateInk).toEqual([18, 22, 25]);
  });

  it("pass every contrast check with the shipped colours, and with other sensible brands", () => {
    for (const [p, a] of [["#1F5AA6", "#F2C230"], ["#C62828", "#FFD54F"], ["#2E7D32", "#FFB300"], ["#4A148C", "#4DD0E1"]]) {
      expect(contrastChecks(p, a).filter((c) => !c.ok), `${p} ${a}`).toEqual([]);
    }
  });

  it("flag a main colour too light for text, and an accent too dark for the scoreboard", () => {
    const checks = contrastChecks("#F2C230", "#1F5AA6");
    expect(checks.find((c) => c.label.startsWith("Links and outlines on the page (light"))?.ok).toBe(false);
    expect(checks.find((c) => c.label.startsWith("Highlights"))?.ok).toBe(false);
  });

  it("keep dark mode readable whatever the main colour", () => {
    for (const hex of ["#000080", "#8B0000", "#004D40", "#3E2723", "#1F5AA6"]) {
      const { dark } = generateTokens(hex, "#F2C230");
      expect(contrast(dark.plate, [26, 31, 35])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.plateInk, dark.plate)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("write a stylesheet for light and dark mode with only validated values", () => {
    const css = brandStylesheet("#1F5AA6", "#F2C230");
    expect(css).toMatch(/^:root\{--plate:31 90 166;.*\}:root\[data-theme="dark"\]\{--plate:\d+ \d+ \d+;/);
    expect(css).not.toMatch(/[<>]/);
  });

  it("round-trip hex", () => {
    expect(rgbToHex(hexToRgb("#1f5aa6"))).toBe("#1F5AA6");
  });
});
