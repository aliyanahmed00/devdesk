export const MESH_BACKGROUND_STORAGE_KEY = "devdesk:mesh-background";

export type MeshBackgroundConfig = {
  /** Master switch for the whole ambient background. */
  enabled: boolean;
  /** Crisp sub-pixel grid overlay. */
  grid: boolean;
  /** Grid cell size in CSS pixels. */
  gridSize: number;
  /** Grid line opacity (0 – 0.4). */
  gridOpacity: number;
  /** Slowly drifting gradient mesh. */
  mesh: boolean;
  /** Gradient mesh intensity (0 – 1). */
  meshIntensity: number;
  /** Focal radial lighting that follows the cursor. */
  spotlight: boolean;
  /** Focal light intensity (0 – 1). */
  spotlightIntensity: number;
  /** Animate the mesh + focal light drift. */
  animated: boolean;
};

export const DEFAULT_MESH_BACKGROUND: MeshBackgroundConfig = {
  enabled: true,
  grid: true,
  gridSize: 28,
  gridOpacity: 0.05,
  mesh: true,
  meshIntensity: 0.5,
  spotlight: true,
  spotlightIntensity: 0.55,
  animated: true,
};

export const MESH_GRID_SIZE_RANGE = { min: 12, max: 72 } as const;
export const MESH_GRID_OPACITY_RANGE = { min: 0, max: 0.4 } as const;
export const MESH_INTENSITY_RANGE = { min: 0, max: 1 } as const;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}

export function normalizeMeshBackground(
  value: Partial<MeshBackgroundConfig> | null | undefined,
): MeshBackgroundConfig {
  return {
    enabled: readBoolean(value?.enabled, DEFAULT_MESH_BACKGROUND.enabled),
    grid: readBoolean(value?.grid, DEFAULT_MESH_BACKGROUND.grid),
    gridSize: readNumber(
      value?.gridSize,
      DEFAULT_MESH_BACKGROUND.gridSize,
      MESH_GRID_SIZE_RANGE.min,
      MESH_GRID_SIZE_RANGE.max,
    ),
    gridOpacity: readNumber(
      value?.gridOpacity,
      DEFAULT_MESH_BACKGROUND.gridOpacity,
      MESH_GRID_OPACITY_RANGE.min,
      MESH_GRID_OPACITY_RANGE.max,
    ),
    mesh: readBoolean(value?.mesh, DEFAULT_MESH_BACKGROUND.mesh),
    meshIntensity: readNumber(
      value?.meshIntensity,
      DEFAULT_MESH_BACKGROUND.meshIntensity,
      MESH_INTENSITY_RANGE.min,
      MESH_INTENSITY_RANGE.max,
    ),
    spotlight: readBoolean(value?.spotlight, DEFAULT_MESH_BACKGROUND.spotlight),
    spotlightIntensity: readNumber(
      value?.spotlightIntensity,
      DEFAULT_MESH_BACKGROUND.spotlightIntensity,
      MESH_INTENSITY_RANGE.min,
      MESH_INTENSITY_RANGE.max,
    ),
    animated: readBoolean(value?.animated, DEFAULT_MESH_BACKGROUND.animated),
  };
}

/* -------------------------------------------------------------------------- */
/* Color helpers                                                              */
/* -------------------------------------------------------------------------- */

export type Rgb = { r: number; g: number; b: number };

/** Parse a `"r g b"` or `"r, g, b"` CSS variable triplet. */
export function parseRgbTriplet(raw: string): Rgb | null {
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return {
    r: clamp(parts[0], 0, 255),
    g: clamp(parts[1], 0, 255),
    b: clamp(parts[2], 0, 255),
  };
}

/** Parse a `#rgb` / `#rrggbb` color. */
export function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation =
      lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rn:
        hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
        break;
      case gn:
        hue = (bn - rn) / delta + 2;
        break;
      default:
        hue = (rn - gn) / delta + 4;
    }
    hue /= 6;
  }

  return [hue, saturation, lightness];
}

function hueToChannel(p: number, q: number, t: number) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToChannel(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToChannel(p, q, h) * 255),
    b: Math.round(hueToChannel(p, q, h - 1 / 3) * 255),
  };
}

/** Rotate a color's hue by `degrees`, keeping saturation + lightness. */
export function rotateHue(color: Rgb, degrees: number): Rgb {
  const [h, s, l] = rgbToHsl(color);
  const next = (((h + degrees / 360) % 1) + 1) % 1;
  return hslToRgb(next, s, l);
}

/** Build an `rgba()` string from an Rgb value. */
export function rgba(color: Rgb, alpha: number): string {
  const a = clamp(alpha, 0, 1);
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${a})`;
}
