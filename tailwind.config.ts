import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // 5-step type scale + a "micro" caption variant for the
      // section labels admin surfaces use everywhere. Adding via
      // `extend` so the default scale (text-xs through text-9xl)
      // stays available — the goal is to migrate away from
      // arbitrary text-[Npx] values to these named steps over time,
      // not break the existing usage in one go.
      fontSize: {
        display: ["2.5rem",   { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "700" }],
        h1:      ["2rem",     { lineHeight: "1.1",  letterSpacing: "-0.02em",  fontWeight: "700" }],
        h2:      ["1.25rem",  { lineHeight: "1.2",  letterSpacing: "-0.01em",  fontWeight: "600" }],
        body:    ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.75rem",  { lineHeight: "1.4" }],
        micro:   ["0.625rem", { lineHeight: "1.3",  letterSpacing: "0.04em" }],
      },
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // 'display' = the heavy editorial serif used on the Customer
        // File sheet and a handful of marketing splashes. Falls back
        // to Georgia, then serif system fonts.
        display: ['"DM Serif Display"', "Georgia", "serif"],
        // 'sans' = the national-tech-brand workhorse. Inter is what
        // Stripe / Linear / Vercel / GitHub / Notion / Apple's web
        // surfaces all ship. Loaded in src/index.css. Used on the
        // Minimal template's headline and any other "Apple-clean"
        // surface that would feel dealer-y in DM Serif Display.
        sans: ['"Inter"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        spin: "spin 0.8s linear infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
