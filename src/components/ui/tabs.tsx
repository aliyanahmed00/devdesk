"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
};

type TabsProps<T extends string> = {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  children?: ReactNode;
  /** Visual style of the tab bar. */
  variant?: "segmented" | "underline";
  size?: "sm" | "md";
  className?: string;
  listClassName?: string;
  panelClassName?: string;
};

/**
 * Accessible, animated tab interface with a sliding active indicator.
 * Implements the WAI-ARIA tabs pattern (roving tabindex + arrow-key nav).
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  children,
  variant = "segmented",
  size = "md",
  className,
  listClassName,
  panelClassName,
}: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === value),
  );
  const segmented = variant === "segmented";

  function select(nextIndex: number) {
    const count = tabs.length;
    const wrapped = (nextIndex + count) % count;
    onChange(tabs[wrapped].id);
    refs.current[wrapped]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(tabs.length - 1);
    }
  }

  return (
    <div className={clsx("flex flex-col", className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className={clsx(
          "relative grid",
          segmented
            ? "rounded-xl border border-border/70 bg-muted/50 p-1"
            : "border-b border-border",
          listClassName,
        )}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className={clsx(
            "pointer-events-none absolute z-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            segmented
              ? "inset-y-1 rounded-lg bg-card shadow-sm ring-1 ring-inset ring-white/10"
              : "bottom-0 h-0.5 rounded-full bg-primary",
          )}
          style={{
            left: segmented ? "0.25rem" : undefined,
            width: segmented
              ? `calc((100% - 0.5rem) / ${tabs.length})`
              : `calc(100% / ${tabs.length})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active}
              aria-controls={children ? `panel-${tab.id}` : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={clsx(
                "relative z-10 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                size === "sm"
                  ? "min-h-11 px-2.5 text-xs sm:min-h-9"
                  : "min-h-11 px-3 text-sm",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon && <Icon className="size-3.5 shrink-0" />}
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
      {children !== undefined && (
        <div
          role="tabpanel"
          id={`panel-${value}`}
          aria-labelledby={`tab-${value}`}
          tabIndex={0}
          className={clsx("focus-visible:outline-none", panelClassName)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
