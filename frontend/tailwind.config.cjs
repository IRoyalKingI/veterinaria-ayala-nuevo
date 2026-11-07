/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--color-surface-raised) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        subtle: "rgb(var(--color-subtle) / <alpha-value>)",
        ayala: {
          blue: "#173B64",
          red: "#C83D45",
          green: "#2F8068",
          ink: "#1C2B3A",
          mist: "#F4F7FA",
        },
      },
      boxShadow: {
        card: "0 12px 32px rgba(23, 59, 100, 0.07)",
      },
    },
  },
  plugins: [],
};
