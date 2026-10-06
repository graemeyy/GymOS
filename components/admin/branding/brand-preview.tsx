"use client";

import { generateTokens, NEUTRALS, tokenVariables, type Rgb } from "@/lib/branding/colour";
import { fontVariable, type BodyFontId, type DisplayFontId } from "@/lib/branding/fonts";

export interface PreviewProps {
  name: string;
  appName: string;
  tagline: string;
  logoText: string;
  logoUrl: string | null;
  primaryColour: string;
  accentColour: string;
  bodyFont: BodyFontId;
  displayFont: DisplayFontId;
}

const NEUTRAL_VARS = {
  light: { "--floor": NEUTRALS.light.floor, "--surface": NEUTRALS.light.surface, "--ink": NEUTRALS.light.ink, "--ink-soft": [86, 95, 102], "--line": [213, 218, 220], "--board": NEUTRALS.light.board, "--board-ink": [239, 241, 239] },
  dark: { "--floor": NEUTRALS.dark.floor, "--surface": NEUTRALS.dark.surface, "--ink": NEUTRALS.dark.ink, "--ink-soft": [154, 165, 172], "--line": [47, 55, 61], "--board": NEUTRALS.dark.board, "--board-ink": [232, 236, 238] },
} satisfies Record<"light" | "dark", Record<string, Rgb | number[]>>;

// What members and staff will see, in light and dark mode, before saving
// (D-124). The same token generator as the live app, applied to this box only.
export function BrandPreview(props: PreviewProps) {
  let tokens: ReturnType<typeof generateTokens> | null = null;
  try {
    tokens = generateTokens(props.primaryColour, props.accentColour);
  } catch {
    tokens = null;
  }
  if (!tokens) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-label="Preview" role="group">
      {(["light", "dark"] as const).map((mode) => {
        const vars = { ...Object.fromEntries(Object.entries(NEUTRAL_VARS[mode]).map(([k, v]) => [k, v.join(" ")])), ...tokenVariables(tokens[mode]) };
        const style = { ...vars, fontFamily: `var(${fontVariable(props.bodyFont)}), system-ui, sans-serif` } as React.CSSProperties;
        const display = { fontFamily: `var(${fontVariable(props.displayFont)}), "Arial Narrow", sans-serif` };
        return (
          <div key={mode} style={style} className="overflow-hidden rounded-lg border border-line bg-floor text-ink">
            <p className="border-b border-line bg-surface px-3 py-1.5 text-xs text-ink-soft">{mode === "light" ? "Light mode" : "Dark mode"}</p>
            <div className="flex items-center gap-2.5 bg-surface px-3 py-3">
              {props.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={props.logoUrl} alt="" className="h-8 w-auto max-w-[8rem] object-contain" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-plate text-xs font-bold text-plate-ink" style={display}>
                  {props.logoText}
                </span>
              )}
              <span className="text-lg font-semibold" style={display}>
                {props.appName}
              </span>
            </div>
            <div className="space-y-3 p-3">
              <p className="text-2xl font-semibold" style={display}>
                {props.name}
              </p>
              <p className="text-sm text-ink-soft">{props.tagline}</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded bg-plate px-3 py-2 text-sm font-medium text-plate-ink">Book a class</span>
                <span className="text-sm font-medium text-plate underline underline-offset-2">View timetable</span>
                <span className="rounded bg-plate-tint px-2 py-1 text-xs font-medium text-ink">Selected</span>
              </div>
              <div className="rounded bg-board px-3 py-2 text-board-ink">
                <span className="text-xs">Overdue payments</span>
                <p className="text-xl font-semibold text-chalk" style={display}>
                  3
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
