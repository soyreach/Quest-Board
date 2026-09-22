/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14122B",
        violet: "#241C6B",
        violet2: "#3B2FA0",
        indigo: "#5B4CF5",
        indigoSoft: "#EEF0FC",
        lavender: "#F5F4FC",
        cork: "#9B6B3C",
        corkDark: "#6E4A28",
        parchment: "#F3E6C4",
        gold: "#C99A3C",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        hand: ["Kalam", "cursive"],
      },
      borderRadius: {
        quest: "4px 14px 6px 16px / 14px 6px 16px 4px",
      },
    },
  },
  plugins: [],
};
