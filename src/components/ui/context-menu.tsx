"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

export type ContextMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  hint?: string;
  danger?: boolean;
  onSelect: () => void;
};

type Position = { x: number; y: number };

export function useContextMenu() {
  const [position, setPosition] = useState<Position | null>(null);

  const openAt = useCallback((x: number, y: number) => {
    setPosition({ x, y });
  }, []);

  const close = useCallback(() => setPosition(null), []);

  return { position, openAt, close };
}

type ContextMenuProps = {
  position: Position | null;
  items: ContextMenuItem[];
  onClose: () => void;
};

const MENU_WIDTH = 232;
const ITEM_HEIGHT = 38;
const MENU_PADDING = 12;

export function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    if (!position) return;

    const onPointerDown = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest("[data-context-menu]")) {
        return;
      }
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onDismiss = () => onClose();

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
    };
  }, [position, onClose]);

  if (!position) return null;

  const menuHeight = items.length * ITEM_HEIGHT + MENU_PADDING;
  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  const x = Math.max(8, Math.min(position.x, vw - MENU_WIDTH - 8));
  const y = Math.max(8, Math.min(position.y, vh - menuHeight - 8));

  return (
    <div
      data-context-menu
      role="menu"
      aria-label="Dashboard actions"
      style={{ left: x, top: y, width: MENU_WIDTH }}
      className="animate-scale-in fixed z-[80] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-1.5 text-card-foreground shadow-2xl backdrop-blur-xl"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className={clsx(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              item.danger
                ? "text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                : "text-zinc-300 hover:bg-zinc-800/70 hover:text-white",
            )}
          >
            {Icon ? <Icon className="size-4 shrink-0 opacity-80" /> : null}
            <span className="flex-1 truncate">{item.label}</span>
            {item.hint ? (
              <kbd className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                {item.hint}
              </kbd>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
