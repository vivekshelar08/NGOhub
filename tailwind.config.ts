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
          teal: "#0D5D56",
          "teal-dark": "#094840",
          "teal-light": "#14857A",
          blue: "#0054A6",
          "blue-light": "#E8F1FA",
          mist: "#F0F7F6",
          ink: "#1A2332",
          "ink-light": "#243044",
          /** Aliases kept for existing class names — mapped to classic palette */
          emerald: "#0D5D56",
          coral: "#E31E24",
          saffron: "#14857A",
          "saffron-light": "#94A3B8",
          sky: "#0054A6",
          violet: "#1A2332",
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
