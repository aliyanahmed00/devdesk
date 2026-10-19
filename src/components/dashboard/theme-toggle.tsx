"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { clsx } from "clsx";

import {
  THEME_META,
  THEME_ORDER,
  useTheme,
} from "@/components/providers/theme-provider";

type ThemeToggleProps = {
  onOpenThemeBuilder?: () => void;
};

export function ThemeToggle({ onOpenThemeBuilder }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = THEME_META[theme];
  const CurrentIcon = current.icon;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        title={`Theme: ${current.label}`}
        className="btn-surface flex h-9 items-center gap-2 rounded-lg px-2.5"
      >
        <CurrentIcon className="size-4" />
        <span className="hidden text-xs font-medium lg:block">{current.label}</span>
        <ChevronDown
          className={clsx(
            "size-3.5 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose theme"
          className="glass animate-slide-down absolute right-0 top-11 z-50 w-64 origin-top-right overflow-hidden rounded-xl p-1.5 shadow-2xl"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Theme presets
          </p>
          {THEME_ORDER.map((id) => {
            const meta = THEME_META[id];
            const Icon = meta.icon;
            const active = id === theme;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(id);
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                  active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border"
                  style={{ background: meta.swatch }}
                >
                  <Icon className="size-3.5 mix-blend-difference" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {meta.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {meta.description}
                  </span>
                </span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
          {onOpenThemeBuilder && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onOpenThemeBuilder();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
              >
                <Palette className="size-4 text-muted-foreground" />
                Custom theme…
              </button>
            </>
          )}
        </div>
      )}
    </div>
  
  );
}
