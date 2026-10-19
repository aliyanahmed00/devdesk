"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "xl";
};

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
      <div
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "glass animate-scale-in relative z-10 flex h-full w-full flex-col overflow-hidden text-card-foreground shadow-2xl sm:h-auto sm:rounded-2xl",
          size === "xl" ? "sm:max-w-5xl" : "sm:max-w-lg",
        )}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
              Esc
            </kbd>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-7"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>
        <div
          className={clsx(
            "p-4",
            size === "xl"
              ? "scrollbar-thin flex-1 overflow-y-auto sm:max-h-[78vh] sm:flex-none"
              : "scrollbar-thin overflow-y-auto",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
