import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          red: "#E31E24",
          "red-dark": "#C9191F",
          "red-light": "#FDE8E9",
          coral: "#F97316",
          saffron: "#F59E0B",
          "saffron-light": "#FCD34D",
          emerald: "#059669",
          teal: "#0D7C6E",
          "teal-dark": "#065F46",
          "teal-light": "#34D399",
          sky: "#0EA5E9",
          violet: "#7C3AED",
          blue: "#0054A6",
          "blue-light": "#E0F2FE",
          mist: "#FFF7ED",
          ink: "#1A2332",
          "ink-light": "#243044",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(26, 35, 50, 0.06), 0 8px 24px rgba(26, 35, 50, 0.04)",
        "card-hover": "0 4px 12px rgba(26, 35, 50, 0.08), 0 12px 32px rgba(13, 93, 86, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
