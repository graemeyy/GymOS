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
        chalk: "#F5F3EE",
        surface: "#FFFFFF",
        "surface-muted": "#EDEAE2",
        ink: "#26241F",
        "ink-soft": "#6F6A61",
        line: "#E2DCCF",
        ember: {
          DEFAULT: "#C1531F",
          soft: "#F1DDCE",
          dark: "#9A4218",
        },
        good: {
          DEFAULT: "#3F7A52",
          soft: "#E1EDE3",
        },
        warn: {
          DEFAULT: "#B07C22",
          soft: "#F3E7D2",
        },
        bad: {
          DEFAULT: "#B23B32",
          soft: "#F3DEDB",
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
