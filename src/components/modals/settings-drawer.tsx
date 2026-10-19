"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import {
  Check,
  Compass,
  Database,
  Download,
  LayoutGrid,
  MousePointer2,
  Palette,
  RotateCcw,
  Trash2,
  Upload,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  ACCENT_META,
  ACCENT_ORDER,
  THEME_META,
  THEME_ORDER,
  useTheme,
  type Accent,
} from "@/components/providers/theme-provider";
import { useMeshBackground } from "@/components/providers/mesh-background-provider";
import { useCollabPresence } from "@/components/providers/collab-presence-provider";
import { useSoundEffects } from "@/components/providers/sound-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { MESH_GRID_SIZE_RANGE } from "@/lib/mesh-background";
import {
  SOUND_EFFECT_DESCRIPTIONS,
  SOUND_EFFECT_LABELS,
  SOUND_EFFECT_NAMES,
} from "@/lib/sound-effects";

import { WIDGETS } from "@/components/dashboard/widget-registry";
import { ACCENTS } from "@/components/dashboard/widget-card";
import { useWidgetLayout } from "@/components/dashboard/widget-layout-provider";

type SettingsDrawerProps = {
  open: boolean;
  onClose: () => void;
  onOpenThemeBuilder: () => void;
  onRestartTour: () => void;
};

type TabId = "appearance" | "widgets" | "sound" | "data";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "widgets", label: "Widgets", icon: LayoutGrid },
  { id: "sound", label: "Sound", icon: Volume2 },
  { id: "data", label: "Data & Backup", icon: Database },
];

const STORAGE_PREFIX = "devdesk:";
const BACKUP_FILENAME = "devdesk-backup.json";

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function SettingsDrawer({
  open,
  onClose,
  onOpenThemeBuilder,
  onRestartTour,
}: SettingsDrawerProps) {
  const [tab, setTab] = useState<TabId>("appearance");
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { theme, setTheme, accent, setAccent } = useTheme();
  const { isEnabled, toggle, reset } = useWidgetLayout();
  const mesh = useMeshBackground();
  const { toast } = useToast();
  const {
    settings: collab,
    setCursorsEnabled,
  } = useCollabPresence();
  const {
    settings: sound,
    setEnabled: setSoundEnabled,
    setVolume: setSoundVolume,
    preview: previewSound,
  } = useSoundEffects();

  function exportBackup() {
    const data: Record<string, unknown> = {};
    let count = 0;
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      data[key] = raw === null ? null : safeParse(raw);
      count += 1;
    }

    const payload = {
      app: "DevDesk",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = BACKUP_FILENAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast(`Exported ${count} settings`, "success");
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          data?: unknown;
        };
        const data =
          parsed && typeof parsed === "object" && "data" in parsed
            ? parsed.data
            : parsed;
        if (!data || typeof data !== "object") {
          throw new Error("Invalid backup");
        }

        let count = 0;
        for (const [key, value] of Object.entries(
          data as Record<string, unknown>,
        )) {
          if (!key.startsWith(STORAGE_PREFIX)) continue;
          window.localStorage.setItem(
            key,
            typeof value === "string" ? value : JSON.stringify(value),
          );
          count += 1;
        }

        if (count === 0) {
          toast("No DevDesk data found in that file", "error");
          return;
        }

        toast(`Restored ${count} settings — reloading…`, "success");
        window.setTimeout(() => window.location.reload(), 700);
      } catch {
        toast("Could not read that backup file", "error");
      }
    };
    reader.readAsText(file);
  }

  function resetEverything() {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
    setConfirmReset(false);
    toast("Workspace reset — reloading…", "info");
    window.setTimeout(() => window.location.reload(), 700);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="glass animate-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l text-card-foreground shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Settings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Theme, widgets and backups — saved to this browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-sound="swoosh"
            aria-label="Close settings"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <Tabs
          tabs={TABS}
          value={tab}
          onChange={setTab}
          ariaLabel="Settings sections"
          size="sm"
          className="flex min-h-0 flex-1 flex-col"
          listClassName="mx-4 mt-4 shrink-0"
          panelClassName="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4"
        >
          {tab === "appearance" && (
            <div className="animate-fade-in flex flex-col gap-6">
              <section>
                <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Theme preset
                </h3>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {THEME_ORDER.map((id) => {
                    const meta = THEME_META[id];
                    const Icon = meta.icon;
                    const active = theme === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTheme(id)}
                        aria-pressed={active}
                        className={clsx(
                          "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                          active
                            ? "border-primary/60 bg-primary/5"
                            : "border-border hover:border-primary/30 hover:bg-muted/50",
                        )}
                      >
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-white/10"
                          style={{ backgroundColor: meta.swatch }}
                        >
                          <Icon className="size-4 text-white/90" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {meta.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {meta.description}
                          </span>
                        </span>
                        {active && (
                          <Check className="size-4 shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Accent glow
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Updates button glows, active tabs and border highlights.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ACCENT_ORDER.map((id: Accent) => {
                    const meta = ACCENT_META[id];
                    const active = accent === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAccent(id)}
                        aria-pressed={active}
                        title={meta.label}
                        className={clsx(
                          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-primary/60 bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                        )}
                      >
                        <span
                          className={clsx(
                            "size-3.5 rounded-full ring-2 ring-inset ring-black/20",
                            active && "ring-white/50",
                          )}
                          style={{
                            background: meta.color
                              ? meta.color
                              : "conic-gradient(from 0deg, #6366f1, #10b981, #06b6d4, #f43f5e, #f59e0b, #6366f1)",
                          }}
                        />
                        {meta.label}
                        {active && <Check className="size-3" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                    Ambient background
                  </h3>
                  <Switch
                    checked={mesh.config.enabled}
                    onChange={(next) => mesh.updateConfig({ enabled: next })}
                    label="Ambient background"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  A slow-drifting gradient mesh and crisp sub-pixel grid, with
                  focal lighting that follows your cursor.
                </p>

                {mesh.config.enabled && (
                  <div className="mt-3 flex flex-col gap-3.5 rounded-xl border border-border p-3.5">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-foreground">
                          Grid overlay
                        </span>
                        <Switch
                          checked={mesh.config.grid}
                          onChange={(next) =>
                            mesh.updateConfig({ grid: next })
                          }
                          label="Grid overlay"
                        />
                      </div>
                      {mesh.config.grid && (
                        <div className="flex flex-col gap-2.5">
                          <SliderRow
                            label="Line opacity"
                            value={Math.round(mesh.config.gridOpacity * 100)}
                            min={0}
                            max={40}
                            step={1}
                            suffix="%"
                            onChange={(value) =>
                              mesh.updateConfig({ gridOpacity: value / 100 })
                            }
                          />
                          <SliderRow
                            label="Cell size"
                            value={mesh.config.gridSize}
                            min={MESH_GRID_SIZE_RANGE.min}
                            max={MESH_GRID_SIZE_RANGE.max}
                            step={2}
                            suffix="px"
                            onChange={(value) =>
                              mesh.updateConfig({ gridSize: value })
                            }
                          />
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-border" />

                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-foreground">
                          Gradient mesh
                        </span>
                        <Switch
                          checked={mesh.config.mesh}
                          onChange={(next) =>
                            mesh.updateConfig({ mesh: next })
                          }
                          label="Gradient mesh"
                        />
                      </div>
                      {mesh.config.mesh && (
                        <SliderRow
                          label="Mesh intensity"
                          value={Math.round(mesh.config.meshIntensity * 100)}
                          min={0}
                          max={100}
                          step={5}
                          suffix="%"
                          onChange={(value) =>
                            mesh.updateConfig({ meshIntensity: value / 100 })
                          }
                        />
                      )}
                    </div>

                    <div className="h-px bg-border" />

                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-foreground">
                          Cursor spotlight
                        </span>
                        <Switch
                          checked={mesh.config.spotlight}
                          onChange={(next) =>
                            mesh.updateConfig({ spotlight: next })
                          }
                          label="Cursor spotlight"
                        />
                      </div>
                      {mesh.config.spotlight && (
                        <SliderRow
                          label="Light intensity"
                          value={Math.round(
                            mesh.config.spotlightIntensity * 100,
                          )}
                          min={0}
                          max={100}
                          step={5}
                          suffix="%"
                          onChange={(value) =>
                            mesh.updateConfig({
                              spotlightIntensity: value / 100,
                            })
                          }
                        />
                      )}
                    </div>

                    <div className="h-px bg-border" />

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-foreground">
                        Drift animation
                      </span>
                      <Switch
                        checked={mesh.config.animated}
                        onChange={(next) =>
                          mesh.updateConfig({ animated: next })
                        }
                        label="Drift animation"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={mesh.resetConfig}
                      className="btn-surface flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                    >
                      <RotateCcw className="size-3.5" />
                      Reset background
                    </button>
                  </div>
                )}
              </section>

              <section>
                <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Theme builder
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Full color-system control — presets, accent hue, surface
                  opacity, glass blur and border tint.
                </p>
                <button
                  type="button"
                  onClick={onOpenThemeBuilder}
                  className="btn-surface mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  <Palette className="size-4" />
                  Open theme builder
                </button>
              </section>

              <section>
                <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Guided tour
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Replay the onboarding tour to revisit the command palette,
                  widget reordering, workspaces and integrations.
                </p>
                <button
                  type="button"
                  onClick={onRestartTour}
                  className="btn-surface mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  <Compass className="size-4" />
                  Restart guided tour
                </button>
              </section>

              <section>
                <h3 className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Collaboration
                </h3>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border p-3.5">
                  <span className="flex min-w-0 items-start gap-3">
                    <MousePointer2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        Team cursor preview
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Show simulated teammate cursors moving across the grid.
                      </span>
                    </span>
                  </span>
                  <Switch
                    checked={collab.cursorsEnabled}
                    onChange={setCursorsEnabled}
                    label="Team cursor preview"
                  />
                </div>
              </section>
            </div>
          )}

          {tab === "widgets" && (
            <div className="animate-fade-in flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Toggle which widgets appear on your dashboard.
              </p>
              <ul className="flex flex-col gap-1">
                {WIDGETS.map((widget) => {
                  const enabled = isEnabled(widget.id);
                  const Icon = widget.icon;
                  return (
                    <li key={widget.id}>
                      <button
                        type="button"
                        onClick={() => toggle(widget.id)}
                        aria-pressed={enabled}
                        className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/50"
                      >
                        <span
                          className={clsx(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                            ACCENTS[widget.accent],
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {widget.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {widget.description}
                          </span>
                        </span>
                        <span
                          className={clsx(
                            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                            enabled ? "bg-primary" : "bg-muted-foreground/30",
                          )}
                        >
                          <span
                            className={clsx(
                              "absolute top-0.5 size-4 rounded-full bg-white transition-all",
                              enabled ? "left-[18px]" : "left-0.5",
                            )}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => {
                  reset();
                  toast("Widgets reset to defaults", "info");
                }}
                className="btn-surface mt-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
              >
                <RotateCcw className="size-4" />
                Reset widgets to defaults
              </button>
            </div>
          )}

          {tab === "sound" && (
            <div className="animate-fade-in flex flex-col gap-4">
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-foreground">
                      UI Sound Effects
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Subtle procedural cues for clicks, drags, drawer toggles
                      and timers. Synthesized on the fly — no audio files.
                    </p>
                  </div>
                  <Switch
                    checked={sound.enabled}
                    onChange={setSoundEnabled}
                    label="UI Sound Effects"
                  />
                </div>

                <div className="mt-4">
                  <SliderRow
                    label="Volume"
                    value={Math.round(sound.volume * 100)}
                    min={0}
                    max={100}
                    step={5}
                    suffix="%"
                    disabled={!sound.enabled}
                    onChange={(value) => setSoundVolume(value / 100)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium text-foreground">
                  Preview cues
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sound.enabled
                    ? "Tap a cue to hear how it sounds."
                    : "Preview is always audible so you can tune before enabling."}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {SOUND_EFFECT_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      data-sound="off"
                      onClick={() => previewSound(name)}
                      className="btn-surface flex flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <Volume2 className="size-3.5" />
                        {SOUND_EFFECT_LABELS[name]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {SOUND_EFFECT_DESCRIPTIONS[name]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "data" && (
            <div className="animate-fade-in flex flex-col gap-3">
              <div className="rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium text-foreground">
                  Export dashboard
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Download notes, tasks, snippets, widgets and preferences as a
                  JSON file.
                </p>
                <button
                  type="button"
                  onClick={exportBackup}
                  className="btn-surface mt-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  <Download className="size-4" />
                  Export devdesk-backup.json
                </button>
              </div>

              <div className="rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium text-foreground">
                  Import dashboard
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Restore your workspace from a previously exported backup file.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importBackup(file);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-surface mt-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  <Upload className="size-4" />
                  Choose backup file…
                </button>
              </div>

              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                <h3 className="text-sm font-medium text-rose-500">
                  Reset to default
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Clears all DevDesk local data and restores the default
                  dashboard. This cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/10"
                >
                  <Trash2 className="size-4" />
                  Reset workspace
                </button>
              </div>
            </div>
          )}
        </Tabs>
      </aside>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset workspace?"
      >
        <p className="text-sm text-muted-foreground">
          This will clear all notes, tasks, snippets, widget layout, theme and
          accent preferences stored in this browser, then reload with defaults.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="btn-surface rounded-lg px-3 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={resetEverything}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500"
          >
            Reset everything
          </button>
        </div>
      </Modal>
    </div>
  );
}

type SliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  disabled = false,
  onChange,
}: SliderRowProps) {
  return (
    <label className={clsx("flex flex-col gap-1", disabled && "opacity-50")}>
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[rgb(var(--primary))] disabled:cursor-not-allowed"
      />
    </label>
  );
}
