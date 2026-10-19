"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, Keyboard, Menu, Search, Settings, X } from "lucide-react";

import {
  THEME_META,
  THEME_ORDER,
  useTheme,
} from "@/components/providers/theme-provider";

import { DASHBOARD_TABS, type DashboardTab } from "./dashboard-tabs";

type MobileMenuProps = {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
};

export function MobileMenu({
  activeTab,
  onSelectTab,
  onOpenPalette,
  onOpenSettings,
  onOpenShortcuts,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="btn-surface flex size-11 items-center justify-center rounded-lg"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open && (
        <div className="glass animate-slide-down absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl p-2 text-card-foreground shadow-2xl">
          <p className="px-3 pb-1 pt-1 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Views
          </p>
          <div className="grid grid-cols-3 gap-1">
            {DASHBOARD_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSelectTab(tab.id);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon
                    className={clsx(
                      "size-4",
                      active ? "text-primary" : undefined,
                    )}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="my-1.5 border-t border-border" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenPalette();
            }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Search className="size-4 text-muted-foreground" />
            Command palette
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Settings className="size-4 text-muted-foreground" />
            Settings
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenShortcuts();
            }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Keyboard className="size-4 text-muted-foreground" />
            Keyboard shortcuts
          </button>

          <div className="my-1.5 border-t border-border" />

          <p className="px-3 pb-1 pt-1 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Theme
          </p>
          <div className="grid grid-cols-2 gap-1">
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
                    "flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{meta.label}</span>
                  {active && (
                    <Check className="ml-auto size-3 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
