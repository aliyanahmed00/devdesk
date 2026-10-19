"use client";

import { useState, type DragEvent } from "react";
import { GripVertical, X } from "lucide-react";
import { clsx } from "clsx";

import { WidgetCard } from "./widget-card";
import { WidgetLoader } from "./widget-loader";
import { useWidgetLayout } from "./widget-layout-provider";
import { useSoundEffects } from "@/components/providers/sound-provider";
import type { WidgetDefinition, WidgetId } from "./widget-registry";

type WidgetGridProps = {
  widgets: WidgetDefinition[];
  onExpand: (id: WidgetId) => void;
};


export function WidgetGrid({ widgets, onExpand }: WidgetGridProps) {
  const { move, remove } = useWidgetLayout();
  const { play } = useSoundEffects();
  const [dragId, setDragId] = useState<WidgetId | null>(null);

  function handleDragStart(event: DragEvent<HTMLButtonElement>, id: WidgetId) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);

    const cell = event.currentTarget.closest("[data-widget-cell]");
    if (cell) {
      const rect = cell.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        cell,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    }
    setDragId(id);
  }

  function handleDragEnter(targetId: WidgetId) {
    if (!dragId || dragId === targetId) return;
    const from = widgets.findIndex((widget) => widget.id === dragId);
    const to = widgets.findIndex((widget) => widget.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    move(from, to);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function endDrag(event: DragEvent<HTMLDivElement>) {
    if (!dragId) return;
    event.preventDefault();
    setDragId(null);
    play("pop");
  }

  return (
    <div
      id="widgets"
      onDragOver={handleDragOver}
      onDrop={endDrag}
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12"
    >
      {widgets.map((widget, index) => {
        const Component = widget.component;
        const isDragging = dragId === widget.id;
        return (
          <div
            key={widget.id}
            data-widget-cell
            onDragEnter={() => handleDragEnter(widget.id)}
            className={clsx("relative", widget.span, isDragging && "z-10")}
          >
            <div className={clsx("h-full", isDragging && "invisible")}>
              <WidgetCard
                id={`widget-${widget.id}`}
                title={widget.title}
                tag={widget.tag}
                accent={widget.accent}
                icon={widget.icon}
                shortcut={index < 4 ? String(index + 1) : undefined}
                onExpand={() => onExpand(widget.id)}
                className="h-full"
                dragHandle={
                  <button
                    type="button"
                    draggable
                    data-tour="widget-drag"
                    data-sound="off"
                    onDragStart={(event) => handleDragStart(event, widget.id)}
                    onDragEnd={() => setDragId(null)}
                    aria-label={`Reorder ${widget.title}`}
                    title="Drag to reorder"
                    className="flex size-9 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing sm:size-7"
                  >
                    <GripVertical className="size-4" />
                  </button>
                }
                action={
                  <button
                    type="button"
                    onClick={() => remove(widget.id)}
                    aria-label={`Hide ${widget.title}`}
                    className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground sm:size-7 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                }
              >
                <WidgetLoader widget={widget}>
                  <Component />
                </WidgetLoader>
              </WidgetCard>
            </div>

            {isDragging && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 animate-pulse rounded-xl border-2 border-dashed border-indigo-500/80 bg-indigo-500/5 shadow-[0_0_25px_rgba(99,102,241,0.3)]"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
