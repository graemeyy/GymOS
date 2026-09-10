/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        chalk: "rgb(var(--color-chalk) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--color-surface-muted) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--color-ink-soft) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        ember: {
          DEFAULT: "rgb(var(--color-ember) / <alpha-value>)",
          soft: "rgb(var(--color-ember-soft) / <alpha-value>)",
          dark: "rgb(var(--color-ember-dark) / <alpha-value>)",
        },
        good: {
          DEFAULT: "rgb(var(--color-good) / <alpha-value>)",
          soft: "rgb(var(--color-good-soft) / <alpha-value>)",
        },
        warn: {
          DEFAULT: "rgb(var(--color-warn) / <alpha-value>)",
          soft: "rgb(var(--color-warn-soft) / <alpha-value>)",
        },
        bad: {
          DEFAULT: "rgb(var(--color-bad) / <alpha-value>)",
          soft: "rgb(var(--color-bad-soft) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
