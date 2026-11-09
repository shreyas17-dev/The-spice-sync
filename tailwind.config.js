/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#fff4ed", 100: "#ffe6d4", 200: "#ffc9a8", 300: "#ffa371", 400: "#ff7a3d", 500: "#fc5a16", 600: "#ed400c", 700: "#c42e0c", 800: "#9c2612", 900: "#7e2212" },
        ink: { 900: "#151a23", 700: "#3b4352", 500: "#6b7385", 300: "#b9bfcc", 100: "#eceef3", 50: "#f6f7fa" },
      },
      fontFamily: { sans: ["Inter", "Segoe UI", "system-ui", "-apple-system", "Roboto", "Arial", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.08)", lift: "0 12px 28px -8px rgba(16,24,40,.18)" },
    },
  },
  plugins: [],
};
