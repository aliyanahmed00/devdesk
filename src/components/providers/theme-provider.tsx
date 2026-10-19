"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  type ReactNode,
} from "react";
import { Moon, Snowflake, Sparkles, Sun, Zap, type LucideIcon } from "lucide-react";

import {
  CUSTOM_THEME_STORAGE_KEY,
  DEFAULT_CUSTOM_THEME,
  applyCustomVars,
  clearCustomVars,
  normalizeCustomTheme,
  type CustomTheme,
} from "@/lib/custom-theme";
import { useLocalStorage } from "@/lib/use-local-storage";

export type Theme =
  | "light"
  | "dark"
  | "nord"
  | "dracula"
  | "oled"
  | "vercel"
  | "tokyo";

export const THEME_STORAGE_KEY = "devdesk:theme";

export const THEME_ORDER: Theme[] = [
  "dark",
  "nord",
  "dracula",
  "oled",
  "vercel",
  "tokyo",
  "light",
];

export const THEME_META: Record<
  Theme,
  { label: string; description: string; icon: LucideIcon; swatch: string }
> = {
  dark: {
    label: "Obsidian Dark",
    description: "Deep neutral dark",
    icon: Moon,
    swatch: "#131317",
  },
  nord: {
    label: "Nord Frost",
    description: "Deep slate with ice blue",
    icon: Snowflake,
    swatch: "#0f172a",
  },
  dracula: {
    label: "Dracula",
    description: "Dark violet · purple / pink",
    icon: Sparkles,
    swatch: "#1e1b2e",
  },
  oled: {
    label: "OLED Cyberpunk",
    description: "Pure black with neon",
    icon: Zap,
    swatch: "#22d3ee",
  },
  vercel: {
    label: "Vercel Dark",
    description: "Monochrome black & white",
    icon: Moon,
    swatch: "#000000",
  },
  tokyo: {
    label: "Tokyo Night",
    description: "Midnight indigo & neon blue",
    icon: Sparkles,
    swatch: "#1a1b26",
  },
  light: {
    label: "Daylight",
    description: "Clean bright mode",
    icon: Sun,
    swatch: "#f6f7fb",
  },
};

function isTheme(value: unknown): value is Theme {
  return (
    value === "light" ||
    value === "dark" ||
    value === "nord" ||
    value === "dracula" ||
    value === "oled" ||
    value === "vercel" ||
    value === "tokyo"
  );
}

function nextTheme(current: Theme): Theme {
  const index = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(index + 1) % THEME_ORDER.length];
}

export type Accent = "theme" | "indigo" | "emerald" | "cyan" | "rose" | "amber";

export const ACCENT_STORAGE_KEY = "devdesk:accent";

export const ACCENT_ORDER: Accent[] = [
  "theme",
  "indigo",
  "emerald",
  "cyan",
  "rose",
  "amber",
];

export const ACCENT_META: Record<Accent, { label: string; color: string | null }> =
  {
    theme: { label: "Theme default", color: null },
    indigo: { label: "Indigo", color: "#6366f1" },
    emerald: { label: "Emerald", color: "#10b981" },
    cyan: { label: "Cyan", color: "#06b6d4" },
    rose: { label: "Rose", color: "#f43f5e" },
    amber: { label: "Amber", color: "#f59e0b" },
  };

function isAccent(value: unknown): value is Accent {
  return ACCENT_ORDER.includes(value as Accent);
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  customTheme: CustomTheme;
  setCustomTheme: (patch: Partial<CustomTheme>) => void;
  resetCustomTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [storedTheme, setStoredTheme] = useLocalStorage<Theme>(
    THEME_STORAGE_KEY,
    "dark",
  );
  const theme = isTheme(storedTheme) ? storedTheme : "dark";

  const [storedAccent, setStoredAccent] = useLocalStorage<Accent>(
    ACCENT_STORAGE_KEY,
    "theme",
  );
  const accent = isAccent(storedAccent) ? storedAccent : "theme";

  const [storedCustom, setStoredCustom] = useLocalStorage<CustomTheme>(
    CUSTOM_THEME_STORAGE_KEY,
    DEFAULT_CUSTOM_THEME,
  );
  const customTheme = useMemo(
    () => normalizeCustomTheme(storedCustom),
    [storedCustom],
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useLayoutEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (customTheme.enabled) {
      applyCustomVars(root, customTheme);
    } else {
      clearCustomVars(root);
    }
  }, [customTheme]);

  const setTheme = useCallback(
    (next: Theme) => setStoredTheme(next),
    [setStoredTheme],
  );

  const setAccent = useCallback(
    (next: Accent) => setStoredAccent(next),
    [setStoredAccent],
  );

  const setCustomTheme = useCallback(
    (patch: Partial<CustomTheme>) => {
      setStoredCustom((current) =>
        normalizeCustomTheme({ ...normalizeCustomTheme(current), ...patch }),
      );
    },
    [setStoredCustom],
  );

  const resetCustomTheme = useCallback(() => {
    setStoredCustom(DEFAULT_CUSTOM_THEME);
  }, [setStoredCustom]);

  const toggleTheme = useCallback(() => {
    setStoredTheme((current) => nextTheme(isTheme(current) ? current : "dark"));
  }, [setStoredTheme]);

  return (
    <ThemeContext
      value={{
        theme,
        setTheme,
        toggleTheme,
        accent,
        setAccent,
        customTheme,
        setCustomTheme,
        resetCustomTheme,
      }}
    >
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
