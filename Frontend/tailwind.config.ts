import type { Config } from "tailwindcss";

const color = (name: string) => `rgb(var(--qlyno-${name}) / <alpha-value>)`;
const scale = (name: string, shades: number[]) => Object.fromEntries(shades.map((shade) => [shade, color(`${name}-${shade}`)]));
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const billingTheme = {
  paper: color("paper"), surface: color("surface"), line: color("line"),
  ink: { ...scale("ink", shades), DEFAULT: color("ink"), soft: color("ink-soft"), muted: color("ink-muted"), faint: color("ink-faint") },
  brand: scale("brand", shades),
  success: scale("success", [50, 100, 400, 500, 600]),
  warning: scale("warning", [50, 100, 400, 500, 600]),
  alert: scale("alert", [50, 100, 400, 500, 600]),
};

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          50: "hsl(var(--primary-50) / <alpha-value>)",
          100: "hsl(var(--primary-100) / <alpha-value>)",
          600: "hsl(var(--primary-600) / <alpha-value>)",
          700: "hsl(var(--primary-700) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          muted: "hsl(var(--sidebar-muted) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
          active: "hsl(var(--sidebar-active) / <alpha-value>)",
        },
        app: {
          bg: color("paper"),
          surface: color("surface"),
          sidebar: color("surface"),
          border: color("line"),
        },
        text: {
          main: color("ink"),
          muted: color("ink-muted"),
        },
        pastel: {
          lavender: color("brand-50"),
          blue: color("brand-50"),
          lime: color("warning-50"),
          teal: color("brand-100"),
        },
        status: {
          success: color("success-500"),
          warning: color("warning-500"),
          critical: color("alert-500"),
          info: color("brand-500"),
        },
        blue: billingTheme.brand,
        slate: billingTheme.ink,
        gray: billingTheme.ink,
        white: color("surface"),
        paper: billingTheme.paper,
        surface: billingTheme.surface,
        ink: billingTheme.ink,
        line: billingTheme.line,
        brand: {
          ...billingTheme.brand,
          blue: color("brand-500"),
          teal: color("brand-600"),
        },
        clay: {
          50: billingTheme.warning[50],
          100: billingTheme.warning[100],
          200: billingTheme.warning[100],
          300: billingTheme.warning[400],
          400: billingTheme.warning[400],
          500: billingTheme.warning[500],
          600: billingTheme.warning[600],
        },
        alert: {
          50: billingTheme.alert[50],
          100: billingTheme.alert[100],
          400: billingTheme.alert[400],
          500: billingTheme.alert[500],
          600: billingTheme.alert[600],
        },
        sage: {
          50: billingTheme.success[50],
          100: billingTheme.success[100],
          400: billingTheme.success[400],
          500: billingTheme.success[500],
        },
      },
      fontFamily: {
        display: ["var(--font-sans)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgb(var(--qlyno-ink-900) / 0.04)",
        card: "0 1px 2px rgb(var(--qlyno-ink-900) / 0.04), 0 10px 24px rgb(var(--qlyno-ink-900) / 0.06)",
        lift: "0 14px 40px rgb(var(--qlyno-ink-900) / 0.12)",
        panel: "0 4px 24px -8px rgb(var(--qlyno-ink-900) / 0.12)",
        pop: "0 8px 30px rgb(var(--qlyno-ink-900) / 0.12)",
      },
      borderRadius: {
        card: "calc(var(--radius) - 4px)",
        control: "calc(var(--radius) - 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
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
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.25s ease-out",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
      spacing: {
        sidebar: "292px",
        "sidebar-collapsed": "80px",
        topbar: "68px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
