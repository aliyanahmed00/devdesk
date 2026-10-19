"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg" | "xl";
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  width = "md",
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        aria-label={title}
        className={clsx(
          "glass animate-slide-in-right absolute right-0 top-0 flex h-full w-full flex-col border-l text-card-foreground shadow-2xl",
          width === "xl"
            ? "max-w-2xl"
            : width === "lg"
              ? "max-w-lg"
              : "max-w-md",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-sound="swoosh"
            aria-label="Close panel"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
          {children}
        </div>

        {footer && (
          <footer className="border-t border-border px-5 py-4">{footer}</footer>
        )}
      </aside>
    </div>
  );
}
