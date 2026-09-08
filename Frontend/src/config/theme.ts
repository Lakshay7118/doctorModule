import type { CSSProperties } from "react";

const billingTheme = {
  paper: "#F8FAFC",
  surface: "#FFFFFF",
  line: "#E2E8F0",
  ink: {
    DEFAULT: "#1B1E26",
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
    950: "#020617",
    soft: "#334155",
    muted: "#64748B",
    faint: "#94A3B8",
  },
  brand: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3468F0",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
    900: "#1E3A8A",
    950: "#172554",
  },
  success: {
    50: "#ECFDF5",
    100: "#D1FAE5",
    400: "#34D399",
    500: "#10B981",
    600: "#059669",
  },
  warning: {
    50: "#FFFBEB",
    100: "#FEF3C7",
    400: "#F59E0B",
    500: "#D97706",
    600: "#B45309",
  },
  alert: {
    50: "#FFF1F2",
    100: "#FFE4E6",
    400: "#F43F5E",
    500: "#E11D48",
    600: "#BE123C",
  },
};


// Select the palette here once for all modules. Add future palettes with this shape.
export const APP_THEME = {
  colors: billingTheme,
  fontSans: "'IBM Plex Sans', system-ui, sans-serif",
  fontMono: "'IBM Plex Mono', ui-monospace, monospace",
  radius: "0.75rem",
};

function rgb(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function hsl(hex: string): string {
  const [r, g, b] = rgb(hex).map((value) => value / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min, lightness = (max + min) / 2;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return [(hue * 60 + 360) % 360, saturation * 100 + "%", lightness * 100 + "%"].join(" ");
}

export function getThemeStyle(): CSSProperties {
  const theme = APP_THEME.colors;
  const variables: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme)) {
    if (typeof value === "string") variables["--qlyno-" + name] = rgb(value).join(" ");
    else for (const [shade, color] of Object.entries(value)) {
      variables["--qlyno-" + name + (shade === "DEFAULT" ? "" : "-" + shade)] = rgb(color).join(" ");
    }
  }
  const semantic = {
    background: theme.paper, foreground: theme.ink.DEFAULT,
    card: theme.surface, "card-foreground": theme.ink.DEFAULT,
    popover: theme.surface, "popover-foreground": theme.ink.DEFAULT,
    primary: theme.brand[500], "primary-foreground": theme.surface,
    "primary-50": theme.brand[50], "primary-100": theme.brand[100],
    "primary-600": theme.brand[600], "primary-700": theme.brand[700],
    secondary: theme.ink[100], "secondary-foreground": theme.ink[900],
    muted: theme.ink[100], "muted-foreground": theme.ink.muted,
    accent: theme.brand[50], "accent-foreground": theme.brand[700],
    destructive: theme.alert[500], "destructive-foreground": theme.surface,
    success: theme.success[500], "success-foreground": theme.surface,
    warning: theme.warning[500], "warning-foreground": theme.surface,
    info: theme.brand[500], "info-foreground": theme.surface,
    border: theme.line, input: theme.line, ring: theme.brand[500],
    sidebar: theme.surface, "sidebar-foreground": theme.ink.DEFAULT,
    "sidebar-muted": theme.ink.muted, "sidebar-border": theme.line,
    "sidebar-active": theme.brand[500],
  };
  for (const [name, color] of Object.entries(semantic)) variables["--" + name] = hsl(color);
  variables["--radius"] = APP_THEME.radius;
  variables["--font-sans"] = APP_THEME.fontSans;
  variables["--font-mono"] = APP_THEME.fontMono;
  return variables as CSSProperties;
}
