// Turns a gym's two brand colours into the design tokens in app/globals.css
// (D-124), and checks every pairing the interface uses against WCAG AA.
// No imports, so the Branding page can show the same results live.

export type Rgb = [number, number, number];

export const HEX = /^#[0-9A-Fa-f]{6}$/;

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

// WCAG 2 relative luminance and contrast ratio.
function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
}

// The fixed neutrals from app/globals.css that brand colours sit on.
export const NEUTRALS = {
  light: { floor: [239, 241, 239] as Rgb, surface: [255, 255, 255] as Rgb, ink: [21, 25, 28] as Rgb, board: [21, 25, 28] as Rgb },
  dark: { floor: [18, 22, 25] as Rgb, surface: [26, 31, 35] as Rgb, ink: [232, 236, 238] as Rgb, board: [9, 12, 14] as Rgb },
};
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

export interface BrandTokens {
  plate: Rgb;
  plateHover: Rgb;
  plateTint: Rgb;
  plateInk: Rgb;
  chalk: Rgb;
  chalkTint: Rgb;
}

// In dark mode the main colour is lightened, keeping its hue, until text in
// it reads on the dark surface; buttons then use dark text.
function darkPlate(primary: Rgb): Rgb {
  const [h, s] = toHsl(primary);
  const sat = Math.min(s + 10, 90);
  for (let l = 68; l <= 92; l += 2) {
    const candidate = fromHsl(h, sat, l);
    if (contrast(candidate, NEUTRALS.dark.floor) >= 7 && contrast(candidate, NEUTRALS.dark.surface) >= 7) return candidate;
  }
  return fromHsl(h, sat, 92);
}

export function generateTokens(primaryHex: string, accentHex: string): { light: BrandTokens; dark: BrandTokens } {
  const primary = hexToRgb(primaryHex);
  const accent = hexToRgb(accentHex);
  const [ph, ps] = toHsl(primary);
  const [ah, as] = toHsl(accent);
  const lightInk = contrast(WHITE, primary) >= contrast(NEUTRALS.light.ink, primary) ? WHITE : NEUTRALS.light.ink;
  const dark = darkPlate(primary);
  return {
    light: {
      plate: primary,
      plateHover: mix(primary, BLACK, 0.2),
      plateTint: fromHsl(ph, Math.min(ps, 70), 92),
      plateInk: lightInk,
      chalk: accent,
      chalkTint: fromHsl(ah, Math.min(as, 85), 89),
    },
    dark: {
      plate: dark,
      plateHover: mix(dark, WHITE, 0.25),
      plateTint: fromHsl(ph, Math.min(ps, 40), 19),
      plateInk: NEUTRALS.dark.floor,
      chalk: accent,
      chalkTint: fromHsl(ah, Math.min(as, 50), 15),
    },
  };
}

export interface ContrastCheck {
  label: string;
  ratio: number;
  ok: boolean;
  fix: string;
}

// WCAG AA for normal text.
export const AA = 4.5;

// Every pairing the interface uses a brand colour in. All must pass AA, and
// the server refuses colours that don't (lib/branding/service.ts).
export function contrastChecks(primaryHex: string, accentHex: string): ContrastCheck[] {
  const t = generateTokens(primaryHex, accentHex);
  const check = (label: string, a: Rgb, b: Rgb, fix: string): ContrastCheck => {
    const ratio = Math.round(contrast(a, b) * 100) / 100;
    return { label, ratio, ok: ratio >= AA, fix };
  };
  const pageWorst = (c: Rgb, mode: "light" | "dark") => (contrast(c, NEUTRALS[mode].floor) < contrast(c, NEUTRALS[mode].surface) ? NEUTRALS[mode].floor : NEUTRALS[mode].surface);
  const boardWorst = (c: Rgb) => (contrast(c, NEUTRALS.light.board) < contrast(c, NEUTRALS.dark.board) ? NEUTRALS.light.board : NEUTRALS.dark.board);
  return [
    check("Links and outlines on the page (light mode)", t.light.plate, pageWorst(t.light.plate, "light"), "Choose a darker main colour."),
    check("Button text on the main colour (light mode)", t.light.plateInk, t.light.plate, "Choose a darker or lighter main colour, away from the middle."),
    check("Links and outlines on the page (dark mode)", t.dark.plate, pageWorst(t.dark.plate, "dark"), "Choose a more saturated main colour."),
    check("Button text on the main colour (dark mode)", t.dark.plateInk, t.dark.plate, "Choose a more saturated main colour."),
    check("Highlights on the dark scoreboard", t.light.chalk, boardWorst(t.light.chalk), "Choose a lighter, brighter accent colour."),
  ];
}

const VAR_NAMES: Record<keyof BrandTokens, string> = {
  plate: "--plate",
  plateHover: "--plate-hover",
  plateTint: "--plate-tint",
  plateInk: "--plate-ink",
  chalk: "--chalk",
  chalkTint: "--chalk-tint",
};

/** CSS custom properties ("R G B", as app/globals.css uses) for one mode. */
export function tokenVariables(tokens: BrandTokens): Record<string, string> {
  return Object.fromEntries(Object.entries(VAR_NAMES).map(([key, name]) => [name, tokens[key as keyof BrandTokens].join(" ")]));
}

/** The stylesheet that overrides app/globals.css with the gym's colours. */
export function brandStylesheet(primaryHex: string, accentHex: string): string {
  const { light, dark } = generateTokens(primaryHex, accentHex);
  const decls = (tokens: BrandTokens) =>
    Object.entries(tokenVariables(tokens))
      .map(([name, value]) => `${name}:${value}`)
      .join(";");
  return `:root{${decls(light)}}:root[data-theme="dark"]{${decls(dark)}}`;
}
