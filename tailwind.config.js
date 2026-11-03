/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // Every color is a theme token from app/globals.css. `ink` is written as
      // channels so opacity modifiers like text-ink/70 work in every theme.
      colors: {
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        danger: "var(--danger)",
        success: "var(--success)",
        warn: "var(--warn-fg)",
        "warn-soft": "var(--warn-bg)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-text)", "sans-serif"],
      },
      // The same concentric radius scale the stylesheet uses.
      borderRadius: {
        sm: "var(--r-xs)",
        DEFAULT: "var(--r-xs)",
        md: "var(--r-xs)",
        lg: "var(--r-sm)",
        xl: "var(--r-md)",
        "2xl": "var(--r-lg)",
        "3xl": "var(--r-xl)",
      },
    },
  },
  plugins: [],
};
