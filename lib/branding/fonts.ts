// The fonts a gym can choose on the Branding page (D-124). Each is loaded by
// next/font in app/layout.tsx and self-hosted, so nothing comes from Google
// at runtime. Only these, so every choice is legible, has the weights the
// design uses and works offline. No imports, so the browser can use it too.

export const BODY_FONTS = [
  { id: "atkinson", label: "Atkinson Hyperlegible Next", note: "Designed for low-vision readers. The default." },
  { id: "inter", label: "Inter", note: "Neutral and compact." },
  { id: "source-sans", label: "Source Sans 3", note: "Open and friendly." },
  { id: "nunito-sans", label: "Nunito Sans", note: "Rounded and soft." },
] as const;

export const DISPLAY_FONTS = [
  { id: "barlow-condensed", label: "Barlow Condensed", note: "Tall and sporty. The default." },
  { id: "oswald", label: "Oswald", note: "Bold, poster-like." },
  { id: "archivo-narrow", label: "Archivo Narrow", note: "Plain and narrow." },
  { id: "saira-condensed", label: "Saira Condensed", note: "Technical, squared-off." },
] as const;

export const BODY_FONT_IDS = BODY_FONTS.map((f) => f.id) as [BodyFontId, ...BodyFontId[]];
export const DISPLAY_FONT_IDS = DISPLAY_FONTS.map((f) => f.id) as [DisplayFontId, ...DisplayFontId[]];
export type BodyFontId = (typeof BODY_FONTS)[number]["id"];
export type DisplayFontId = (typeof DISPLAY_FONTS)[number]["id"];

/** The CSS variable next/font sets for each font (app/layout.tsx). */
export function fontVariable(id: BodyFontId | DisplayFontId): string {
  return `--font-${id}`;
}
