"use client";

import { Check, Palette, RotateCcw, SlidersHorizontal } from "lucide-react";
import { clsx } from "clsx";

import {
  useTheme,
  type Theme,
} from "@/components/providers/theme-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Modal } from "@/components/ui/modal";
import { toHexColor } from "@/lib/custom-theme";

type ThemeBuilderModalProps = {
  open: boolean;
  onClose: () => void;
};

const PRESETS: {
  id: Theme;
  label: string;
  description: string;
  swatch: string;
  badge?: string;
}[] = [
  {
    id: "dark",
    label: "Obsidian",
    description: "Deep neutral dark",
    swatch: "#09090b",
    badge: "Default",
  },
  {
    id: "vercel",
    label: "Vercel Dark",
    description: "Monochrome black & white",
    swatch: "#000000",
  },
  {
    id: "nord",
    label: "Nord Frost",
    description: "Arctic slate & ice blue",
    swatch: "#0f172a",
  },
  {
    id: "oled",
    label: "Cyberpunk OLED",
    description: "Pure black with neon cyan",
    swatch: "#22d3ee",
  },
  {
    id: "tokyo",
    label: "Tokyo Night",
    description: "Midnight indigo & neon blue",
    swatch: "#1a1b26",
  },
];

export function ThemeBuilderModal({ open, onClose }: ThemeBuilderModalProps) {
  const { theme, setTheme, customTheme, setCustomTheme, resetCustomTheme } =
    useTheme();
  const { toast } = useToast();

  const disabled = !customTheme.enabled;

  function enableCustom() {
    const style = getComputedStyle(document.documentElement);
    const accent = toHexColor(
      style.getPropertyValue("--primary"),
      customTheme.accent,
    );
    const borderTint = toHexColor(
      style.getPropertyValue("--border"),
      customTheme.borderTint,
    );
    setCustomTheme({ enabled: true, accent, borderTint });
  }

  function syncFromTheme() {
    enableCustom();
    toast("Synced tokens from the current theme", "info");
  }

  function handleReset() {
    resetCustomTheme();
    toast("Custom colors reset to defaults", "info");
  }

  return (
    <Modal open={open} onClose={onClose} title="Theme Builder" size="xl">
      <div className="flex flex-col gap-6">
        <section>
          <h3 className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Theme preset
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Switch the whole palette instantly. Your custom tokens layer on top.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRESETS.map((preset) => {
              const active = theme === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTheme(preset.id)}
                  aria-pressed={active}
                  className={clsx(
                    "group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-primary/60 bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-muted/50",
                  )}
                >
                  <span
                    className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-lg ring-1 ring-inset ring-white/10"
                    style={{ backgroundColor: preset.swatch }}
                  >
                    <span
                      className="absolute -right-3 -bottom-3 size-12 rounded-full opacity-70 blur-md"
                      style={{
                        background: `linear-gradient(135deg, ${preset.swatch}, color-mix(in oklab, ${preset.swatch} 40%, #ffffff))`,
                      }}
                    />
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {preset.label}
                    </span>
                    {active && (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] text-muted-foreground">
                      {preset.description}
                    </span>
                  </span>
                  {preset.badge && (
                    <span className="absolute top-2 right-2 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white/80 uppercase backdrop-blur">
                      {preset.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Custom color tokens
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground">
              --accent · --card-bg · --border-color
            </span>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-foreground">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                Enable custom color system
              </span>
              <span className="pl-6 text-[11px] text-muted-foreground">
                Bind custom values to root CSS variables across the app.
              </span>
            </span>
            <input
              type="checkbox"
              checked={customTheme.enabled}
              onChange={(event) => {
                if (event.target.checked) enableCustom();
                else setCustomTheme({ enabled: false });
              }}
              className="size-5 accent-[var(--primary)]"
            />
          </label>

          <div
            className={clsx(
              "flex flex-col gap-4 transition-opacity",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <Palette className="size-4 text-muted-foreground" />
                Primary accent
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {customTheme.accent}
                </span>
                <input
                  type="color"
                  value={customTheme.accent}
                  onChange={(event) =>
                    setCustomTheme({ accent: event.target.value })
                  }
                  aria-label="Primary accent color"
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                />
              </span>
            </div>

            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  Surface background opacity
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {customTheme.surfaceOpacity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={customTheme.surfaceOpacity}
                onChange={(event) =>
                  setCustomTheme({ surfaceOpacity: Number(event.target.value) })
                }
                aria-label="Surface background opacity"
                className="range-touch mt-1 w-full"
              />
            </div>

            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  Card glass blur intensity
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {customTheme.glassBlur}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={customTheme.glassBlur}
                onChange={(event) =>
                  setCustomTheme({ glassBlur: Number(event.target.value) })
                }
                aria-label="Card glass blur intensity"
                className="range-touch mt-1 w-full"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                Border highlight tint
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {customTheme.borderTint}
                </span>
                <input
                  type="color"
                  value={customTheme.borderTint}
                  onChange={(event) =>
                    setCustomTheme({ borderTint: event.target.value })
                  }
                  aria-label="Border highlight tint"
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                />
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={syncFromTheme}
              className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
            >
              <Palette className="size-4" />
              Sync from theme
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
            >
              <RotateCcw className="size-4" />
              Reset custom colors
            </button>
          </div>
        </section>

        <section className="border-t border-border pt-5">
          <h3 className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Live preview
          </h3>
          <div className="mt-3 rounded-xl border border-border bg-background p-4">
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Palette className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    Preview surface
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Glass blur, surface opacity & border tint
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="btn-primary rounded-lg px-3 py-1.5 text-xs font-medium">
                  Primary action
                </span>
                <span className="btn-surface rounded-lg px-3 py-1.5 text-xs font-medium">
                  Surface action
                </span>
                <span className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground">
                  Muted
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
