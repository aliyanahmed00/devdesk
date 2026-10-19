import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Maximize2, type LucideIcon } from "lucide-react";

import type { WidgetAccent } from "./widget-registry";

type WidgetCardProps = {
  id?: string;
  title: string;
  tag?: string;
  accent?: WidgetAccent;
  icon: LucideIcon;
  shortcut?: string;
  action?: ReactNode;
  dragHandle?: ReactNode;
  onExpand?: () => void;
  children: ReactNode;
  className?: string;
};

export const ACCENTS: Record<WidgetAccent, string> = {
  indigo:
    "bg-indigo-500/15 text-indigo-400 ring-indigo-400/25 shadow-[0_0_14px_-3px_rgba(99,102,241,0.6)]",
  amber:
    "bg-amber-500/15 text-amber-400 ring-amber-400/25 shadow-[0_0_14px_-3px_rgba(245,158,11,0.6)]",
  emerald:
    "bg-emerald-500/15 text-emerald-400 ring-emerald-400/25 shadow-[0_0_14px_-3px_rgba(16,185,129,0.6)]",
  violet:
    "bg-violet-500/15 text-violet-400 ring-violet-400/25 shadow-[0_0_14px_-3px_rgba(139,92,246,0.6)]",
  sky: "bg-sky-500/15 text-sky-400 ring-sky-400/25 shadow-[0_0_14px_-3px_rgba(14,165,233,0.6)]",
  teal: "bg-teal-500/15 text-teal-400 ring-teal-400/25 shadow-[0_0_14px_-3px_rgba(20,184,166,0.6)]",
  cyan: "bg-cyan-500/15 text-cyan-400 ring-cyan-400/25 shadow-[0_0_14px_-3px_rgba(6,182,212,0.6)]",
  rose: "bg-rose-500/15 text-rose-400 ring-rose-400/25 shadow-[0_0_14px_-3px_rgba(244,63,94,0.6)]",
  zinc: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/25 shadow-[0_0_14px_-3px_rgba(161,161,170,0.5)]",
};

export function WidgetCard({
  id,
  title,
  tag,
  accent = "zinc",
  icon: Icon,
  shortcut,
  action,
  dragHandle,
  onExpand,
  children,
  className,
}: WidgetCardProps) {
  return (
    <section
      id={id}
      className={clsx(
        "group/card glass card-hover card-rim animate-slide-up flex scroll-mt-20 flex-col overflow-hidden rounded-xl text-card-foreground transition-transform duration-200 hover:-translate-y-0.5",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          {dragHandle}
          <span
            className={clsx(
              "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
              ACCENTS[accent],
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col leading-none">
            <h2 className="truncate text-sm font-semibold tracking-tight">
              {title}
            </h2>
            {tag && (
              <span className="mt-1 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                {tag}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {shortcut && (
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:block">
              {shortcut}
            </kbd>
          )}
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label={`Expand ${title}`}
              title="Expand"
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground sm:size-7 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
            >
              <Maximize2 className="size-3.5" />
            </button>
          )}
          {action}
        </div>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}
