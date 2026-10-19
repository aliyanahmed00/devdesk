"use client";

import { useMemo, useState } from "react";
import {
  Blocks,
  Eye,
  Focus,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

import { useToast } from "@/components/providers/toast-provider";

import { ACCENTS } from "./widget-card";
import {
  WIDGETS,
  WIDGET_CATEGORIES,
  getWidget,
  type WidgetCategoryFilter,
  type WidgetId,
} from "./widget-registry";
import { useWidgetLayout } from "./widget-layout-provider";

type WidgetsViewProps = {
  onPreview: (id: WidgetId) => void;
};

type Preset = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  widgets: WidgetId[];
};

const PRESETS: Preset[] = [
  {
    id: "minimal",
    title: "Minimal Workspace",
    description: "Notes and tasks only.",
    icon: Sparkles,
    widgets: ["notes", "task-board"],
  },
  {
    id: "full",
    title: "Full Developer Stack",
    description: "Enable every widget.",
    icon: Blocks,
    widgets: WIDGETS.map((widget) => widget.id),
  },
  {
    id: "focus",
    title: "Focus Mode",
    description: "Pomodoro, lofi and terminal.",
    icon: Focus,
    widgets: ["pomodoro", "lofi", "terminal"],
  },
];

const ALL_WIDGETS = WIDGETS.length;

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        on
          ? "bg-primary shadow-[0_0_10px_rgb(var(--glow)/0.5)]"
          : "bg-muted-foreground/30",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 size-4 rounded-full bg-white transition-all",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </span>
  );
}

function WidgetPreview({
  id,
  tag,
  active,
}: {
  id: WidgetId;
  tag: string;
  active: boolean;
}) {
  const widget = getWidget(id);
  if (!widget) return null;
  const Component = widget.component;

  return (
    <div className="relative h-44 overflow-hidden rounded-t-xl border-b border-border/60 bg-background/50">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 border-b border-border/50 bg-card/70 px-3 py-2 backdrop-blur-sm">
        <span className="size-2 rounded-full bg-rose-400/70" />
        <span className="size-2 rounded-full bg-amber-400/70" />
        <span className="size-2 rounded-full bg-emerald-400/70" />
        <span className="ml-2 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
          {tag}
        </span>
        <span
          className={clsx(
            "ml-auto text-[10px] font-medium",
            active ? "text-emerald-400" : "text-muted-foreground",
          )}
        >
          {active ? "Active" : "Disabled"}
        </span>
      </div>

      <div className="flex h-full items-start justify-center overflow-hidden pt-7">
        <div
          inert
          aria-hidden
          className="pointer-events-none h-[520px] w-[820px] shrink-0 origin-top scale-[0.46] select-none p-4"
        >
          <Component />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card/95 to-transparent" />
    </div>
  );
}

export function WidgetsView({ onPreview }: WidgetsViewProps) {
  const { enabled, isEnabled, toggle, reset, setLayout } = useWidgetLayout();
  const { toast } = useToast();

  const [filter, setFilter] = useState<WidgetCategoryFilter>("all");

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = { all: ALL_WIDGETS };
    for (const widget of WIDGETS) {
      map[widget.category] = (map[widget.category] ?? 0) + 1;
    }
    return map;
  }, []);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? WIDGETS
        : WIDGETS.filter((widget) => widget.category === filter),
    [filter],
  );

  function applyPreset(preset: Preset) {
    setLayout(preset.widgets);
    setFilter("all");
    toast(`${preset.title} applied — ${preset.widgets.length} widgets active`, "success");
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            {"// widget library"}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
            Widget gallery
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {enabled.length} of {ALL_WIDGETS} widgets active — changes appear on
            the Overview instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            toast("Widgets reset to defaults", "info");
          }}
          className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <RotateCcw className="size-4" />
          Reset to defaults
        </button>
      </header>

      <section>
        <h2 className="mb-3 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
          Preset layouts
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isActive =
              preset.widgets.length === enabled.length &&
              preset.widgets.every((id) => enabled.includes(id));
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={clsx(
                  "glass card-hover flex items-start gap-3 rounded-xl p-4 text-left transition-colors",
                  isActive && "border-primary/50 ring-1 ring-primary/40",
                )}
              >
                <span
                  className={clsx(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                    isActive
                      ? "bg-primary/15 text-primary ring-primary/30"
                      : "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {preset.title}
                    </span>
                    {isActive && (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-primary uppercase">
                        active
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground/80">
                    {preset.widgets.length} widgets
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          {WIDGET_CATEGORIES.map((category) => {
            const active = filter === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setFilter(category.id)}
                aria-pressed={active}
                className={clsx(
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {category.label}
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                    active ? "bg-primary/15 text-primary" : "bg-muted/60",
                  )}
                >
                  {countByCategory[category.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((widget) => {
            const Icon = widget.icon;
            const active = isEnabled(widget.id);
            return (
              <article
                key={widget.id}
                className="glass card-hover card-rim flex flex-col overflow-hidden rounded-xl transition-transform duration-200 hover:-translate-y-0.5"
              >
                <WidgetPreview id={widget.id} tag={widget.tag} active={active} />

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={clsx(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                        ACCENTS[widget.accent],
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-foreground">
                        {widget.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {widget.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <button
                      type="button"
                      onClick={() => onPreview(widget.id)}
                      className="btn-surface flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      <Eye className="size-3.5" />
                      Open
                    </button>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={active}
                      aria-label={`${active ? "Disable" : "Enable"} ${widget.title}`}
                      onClick={() => {
                        toggle(widget.id);
                        toast(
                          active
                            ? `${widget.title} removed from board`
                            : `${widget.title} added to board`,
                          active ? "info" : "success",
                        );
                      }}
                      className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {active ? "Active" : "Disabled"}
                      <Switch on={active} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
