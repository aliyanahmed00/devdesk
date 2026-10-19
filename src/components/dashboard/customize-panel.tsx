"use client";

import { RotateCcw, X } from "lucide-react";
import { clsx } from "clsx";

import { useToast } from "@/components/providers/toast-provider";

import { WIDGETS } from "./widget-registry";
import { ACCENTS } from "./widget-card";
import { useWidgetLayout } from "./widget-layout-provider";

type CustomizePanelProps = {
  open: boolean;
  onClose: () => void;
};

export function CustomizePanel({ open, onClose }: CustomizePanelProps) {
  const { isEnabled, toggle, reset } = useWidgetLayout();
  const { toast } = useToast();

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
        aria-label="Customize dashboard"
        className="glass animate-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l text-card-foreground shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Customize dashboard
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Toggle widgets and drag the grid handles to reorder.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-sound="swoosh"
            aria-label="Close panel"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
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
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted"
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
                      <span className="flex items-center gap-2">
                        <span className="block text-sm font-medium text-foreground">
                          {widget.title}
                        </span>
                        <span className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                          {widget.tag}
                        </span>
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
        </div>

        <footer className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => {
              reset();
              toast("Layout reset to defaults", "info");
            }}
            className="btn-surface flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <RotateCcw className="size-4" />
            Reset layout
          </button>
        </footer>
      </aside>
    </div>
  );
}
