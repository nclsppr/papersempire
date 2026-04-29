import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Game-specific palette
        paper: {
          50: "#fefefe",
          100: "#f7f9fc",
          200: "#eef2f7",
          300: "#dde4ee",
        },
        money: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        sky: {
          soft: "#bfdbfe",
        },
        sun: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: [
          "Nunito",
          "ui-rounded",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(15, 23, 42, 0.12)",
        pop: "0 12px 30px -10px rgba(16, 185, 129, 0.45)",
        sun: "0 10px 25px -8px rgba(245, 158, 11, 0.45)",
      },
      keyframes: {
        "float-up": {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { transform: "translateY(-44px)", opacity: "0" },
        },
        "soft-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
        "machine-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "smoke-rise": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "0.7" },
          "100%": { transform: "translateY(-30px) scale(1.4)", opacity: "0" },
        },
        "truck-drive": {
          "0%": { transform: "translateX(-10px)" },
          "45%": { transform: "translateX(60%)" },
          "55%": { transform: "translateX(60%)" },
          "100%": { transform: "translateX(120%)" },
        },
        "conveyor-flow": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "32px 0" },
        },
        "shine": {
          "0%": { transform: "translateX(-120%) skewX(-20deg)" },
          "100%": { transform: "translateX(220%) skewX(-20deg)" },
        },
      },
      animation: {
        "float-up": "float-up 1.2s ease-out forwards",
        "soft-pulse": "soft-pulse 2.6s ease-in-out infinite",
        "machine-bob": "machine-bob 1.6s ease-in-out infinite",
        "smoke-rise": "smoke-rise 2.4s ease-out infinite",
        "truck-drive": "truck-drive 6s linear infinite",
        "conveyor-flow": "conveyor-flow 0.8s linear infinite",
        "shine": "shine 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
