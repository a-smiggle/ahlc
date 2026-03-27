import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        token: {
          income: "var(--token-income)",
          expenses: "var(--token-expenses)",
          risk: "var(--token-risk)",
          scenario: "var(--token-scenario)",
          ink: "var(--token-ink)",
          mist: "var(--token-mist)",
          panel: "var(--token-panel)",
          accent: "var(--token-accent)"
        }
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Work Sans'", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
