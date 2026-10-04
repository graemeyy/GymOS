import type { Config } from "tailwindcss";

// Only design tokens exist here. Colours, type sizes, radii and shadows are
// replaced (not extended) so nothing off-system can be used by accident.
// Rationale lives in docs/DESIGN.md.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#FFFFFF",
      floor: token("floor"),
      surface: token("surface"),
      sunken: token("sunken"),
      ink: token("ink"),
      "ink-soft": token("ink-soft"),
      line: token("line"),
      "line-strong": token("line-strong"),
      plate: {
        DEFAULT: token("plate"),
        hover: token("plate-hover"),
        tint: token("plate-tint"),
        ink: token("plate-ink"),
      },
      chalk: {
        DEFAULT: token("chalk"),
        tint: token("chalk-tint"),
      },
      good: { DEFAULT: token("good"), tint: token("good-tint") },
      warn: { DEFAULT: token("warn"), tint: token("warn-tint") },
      bad: { DEFAULT: token("bad"), tint: token("bad-tint") },
      scrim: token("scrim"),
      board: { DEFAULT: token("board"), ink: token("board-ink"), soft: token("board-soft") },
    },
    fontFamily: {
      display: ["var(--font-display)", "Arial Narrow", "sans-serif"],
      sans: ["var(--font-body)", "system-ui", "sans-serif"],
    },
    // 1.25 ratio from a 16px base, rounded to whole pixels.
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.25rem", { lineHeight: "1.75rem" }],
      xl: ["1.5625rem", { lineHeight: "2rem" }],
      "2xl": ["1.9375rem", { lineHeight: "2.25rem" }],
      "3xl": ["2.4375rem", { lineHeight: "2.75rem" }],
      "4xl": ["3.0625rem", { lineHeight: "3.25rem" }],
      "5xl": ["4.75rem", { lineHeight: "4.5rem" }],
    },
    borderRadius: {
      none: "0",
      sm: "4px",
      DEFAULT: "6px",
      lg: "10px",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      overlay: "0 16px 40px -12px rgb(var(--shadow) / 0.35)",
    },
    extend: {
      maxWidth: { prose: "68ch" },
      minHeight: { tap: "44px" },
      minWidth: { tap: "44px" },
      height: { tap: "44px" },
      width: { tap: "44px" },
    },
  },
  plugins: [],
};

export default config;
