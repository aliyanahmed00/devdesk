"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, ChevronDown, Plus, SlidersHorizontal } from "lucide-react";

import { useWorkspace } from "@/components/providers/workspace-provider";

type WorkspaceSwitcherProps = {
  onManage: () => void;
};

export function WorkspaceSwitcher({ onManage }: WorkspaceSwitcherProps) {
  const { profiles, activeId, activeProfile, switchTo } = useWorkspace();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const name = activeProfile?.name ?? "Default";
  const glyph = activeProfile?.glyph ?? "🗂️";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-tour="workspace"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          "group flex items-center gap-2 rounded-lg text-2xl font-semibold tracking-tight transition-colors",
          open ? "text-foreground" : "hover:text-foreground/90",
        )}
      >
        <span aria-hidden className="text-xl leading-none">
          {glyph}
        </span>
        <span>{name}</span>
        <ChevronDown
          className={clsx(
            "size-5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Workspace profiles"
          className="glass animate-slide-down absolute left-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-2xl p-2 text-card-foreground shadow-2xl"
        >
          <p className="px-3 pb-1 pt-1 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Workspaces
          </p>
          <ul className="flex flex-col gap-0.5">
            {profiles.map((profile) => {
              const active = profile.id === activeId;
              return (
                <li key={profile.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      switchTo(profile.id);
                      setOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {profile.glyph}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {profile.name}
                    </span>
                    {active && (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="my-1.5 border-t border-border" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-4" />
            New / manage workspaces
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SlidersHorizontal className="size-4" />
            Export &amp; import…
          </button>
        </div>
      )}
    </div>
  );
}
