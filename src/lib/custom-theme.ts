export type CustomTheme = {
  enabled: boolean;
  accent: string;
  surfaceOpacity: number;
  glassBlur: number;
  borderTint: string;
};

export const CUSTOM_THEME_STORAGE_KEY = "devdesk:theme-custom";

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  enabled: false,
  accent: "#6366f1",
  surfaceOpacity: 70,
  glassBlur: 16,
  borderTint: "#3f3f46",
};

/**
 * Root CSS variables written by the custom theme layer. Kept in sync with the
 * pre-paint init script in `layout.tsx`.
 */
export const MANAGED_CUSTOM_VARS = [
  "--primary",
  "--primary-strong",
  "--ring",
  "--glow",
  "--accent",
  "--card-bg",
  "--glass-blur",
  "--border-color",
  "--border",
] as const;

export function isHexColor(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
  );
}

export function hexToRgb(hex: string): [number, number, number] {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return [99, 102, 241];
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Lighten (amount > 0) or darken (amount < 0) a hex color. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const adjust = (channel: number) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(
          amount < 0
            ? channel * (1 + amount)
            : channel + (255 - channel) * amount,
        ),
      ),
    );
  return rgbToHex(adjust(r), adjust(g), adjust(b));
}

export function toHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!isHexColor(trimmed)) return fallback;
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function normalizeCustomTheme(raw: unknown): CustomTheme {
  const value = (raw ?? {}) as Partial<CustomTheme>;
  const clamp = (input: unknown, min: number, max: number, fallback: number) => {
    const numeric =
      typeof input === "number" && Number.isFinite(input) ? input : fallback;
    return Math.min(max, Math.max(min, Math.round(numeric)));
  };
  return {
    enabled:
      typeof value.enabled === "boolean"
        ? value.enabled
        : DEFAULT_CUSTOM_THEME.enabled,
    accent: isHexColor(value.accent)
      ? value.accent
      : DEFAULT_CUSTOM_THEME.accent,
    surfaceOpacity: clamp(
      value.surfaceOpacity,
      0,
      100,
      DEFAULT_CUSTOM_THEME.surfaceOpacity,
    ),
    glassBlur: clamp(value.glassBlur, 0, 40, DEFAULT_CUSTOM_THEME.glassBlur),
    borderTint: isHexColor(value.borderTint)
      ? value.borderTint
      : DEFAULT_CUSTOM_THEME.borderTint,
  };
}

export function buildCustomVars(custom: CustomTheme): Record<string, string> {
  const [r, g, b] = hexToRgb(custom.accent);
  return {
    "--primary": custom.accent,
    "--primary-strong": shade(custom.accent, -0.16),
    "--ring": shade(custom.accent, 0.2),
    "--glow": `${r} ${g} ${b}`,
    "--accent": `color-mix(in oklab, ${custom.accent} 16%, transparent)`,
    "--card-bg": `color-mix(in oklab, var(--card) ${custom.surfaceOpacity}%, transparent)`,
    "--glass-blur": `${custom.glassBlur}px`,
    "--border-color": custom.borderTint,
    "--border": custom.borderTint,
  };
}

export function applyCustomVars(root: HTMLElement, custom: CustomTheme) {
  const vars = buildCustomVars(custom);
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

export function clearCustomVars(root: HTMLElement) {
  for (const name of MANAGED_CUSTOM_VARS) {
    root.style.removeProperty(name);
  }
}
