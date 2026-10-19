"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Focus,
  ListChecks,
  Search,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

import { useToast } from "@/components/providers/toast-provider";
import { Modal } from "@/components/ui/modal";
import {
  createTask,
  INITIAL_BOARD,
  normalizeBoard,
  type Board,
} from "@/components/widgets/task-board-widget";
import { useWidgetLayout } from "@/components/dashboard/widget-layout-provider";
import type { DashboardTab } from "@/components/dashboard/dashboard-tabs";
import { useLocalStorage } from "@/lib/use-local-storage";
import { emitWidgetAction, focusWidget } from "@/lib/widget-actions";

export const FLOATING_BAR_STORAGE_KEY = "devdesk:floating-bar";

type FloatingActionBarProps = {
  onOpenSearch: () => void;
  onNavigate: (tab: DashboardTab) => void;
  focusMode: boolean;
  onToggleFocus: () => void;
};


type DockButtonProps = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  active?: boolean;
};

function DockButton({ icon: Icon, label, hint, onClick, active }: DockButtonProps) {
  return (
    <div className="group/dock relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        title={label}
        className={clsx(
          "flex size-10 items-center justify-center rounded-full transition-colors",
          active
            ? "bg-primary/20 text-primary ring-1 ring-inset ring-primary/40"
            : "text-zinc-300 hover:bg-zinc-800/70 hover:text-white",
        )}
      >
        <Icon className="size-[18px]" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover/dock:opacity-100"
      >
        {label}
        {hint ? (
          <kbd className="rounded border border-zinc-700 px-1 py-0.5 font-mono text-[9px] text-zinc-400">
            {hint}
          </kbd>
        ) : null}
      </span>
    </div>
  );
}

export function FloatingActionBar({
  onOpenSearch,
  onNavigate,
  focusMode,
  onToggleFocus,
}: FloatingActionBarProps) {
  const [visible, setVisible] = useLocalStorage<boolean>(
    FLOATING_BAR_STORAGE_KEY,
    true,
  );
  const [, setBoard] = useLocalStorage<Board>("devdesk:tasks", INITIAL_BOARD);
  const { isEnabled, enable } = useWidgetLayout();
  const { toast } = useToast();

  const [taskOpen, setTaskOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function openQuickTask() {
    setDraft("");
    setTaskOpen(true);
  }

  function submitTask() {
    const title = draft.trim();
    if (!title) return;
    setBoard((current) => {
      const board = normalizeBoard(current);
      return {
        ...board,
        todo: [...board.todo, createTask(title)],
      };
    });
    if (!isEnabled("task-board")) enable("task-board");
    setTaskOpen(false);
    setDraft("");
    onNavigate("overview");
    window.setTimeout(() => focusWidget("task-board"), 140);
    toast("Task added to To Do", "success");
  }

  function openQuickNote() {
    if (!isEnabled("notes")) enable("notes");
    onNavigate("overview");
    window.setTimeout(() => {
      emitWidgetAction("notes:new");
      focusWidget("notes");
    }, 140);
    toast("Opened the Notes editor", "info");
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        {visible ? (
          <div className="animate-dock-in flex items-center gap-3 rounded-full border border-zinc-800/80 bg-zinc-950/80 px-4 py-2 shadow-2xl backdrop-blur-xl">
            <DockButton
              icon={ListChecks}
              label="Quick task"
              onClick={openQuickTask}
            />
            <DockButton
              icon={StickyNote}
              label="Quick note"
              onClick={openQuickNote}
            />
            <DockButton
              icon={Focus}
              label={focusMode ? "Exit focus mode" : "Focus mode"}
              onClick={onToggleFocus}
              active={focusMode}
            />
            <DockButton
              icon={Search}
              label="Search"
              hint="⌘K"
              onClick={onOpenSearch}
            />
            <span aria-hidden className="mx-0.5 h-6 w-px bg-zinc-800" />
            <DockButton
              icon={ChevronDown}
              label="Hide quick actions"
              onClick={() => setVisible(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setVisible(true)}
            aria-label="Show quick actions"
            title="Show quick actions"
            className="animate-fade-in group flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/80 px-3 py-2 text-xs font-medium text-zinc-400 shadow-2xl backdrop-blur-xl transition-colors hover:text-zinc-100"
          >
            <ChevronUp className="size-4 transition-transform group-hover:-translate-y-0.5" />
            Quick actions
          </button>
        )}
      </div>

      <Modal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        title="Quick task"
      >
        <p className="text-sm text-muted-foreground">
          Append a task straight to your <span className="font-medium text-foreground">To Do</span> column.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitTask();
          }}
          className="mt-4 flex items-center gap-2"
        >
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What needs doing?"
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="btn-primary h-10 rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add task
          </button>
        </form>
      </Modal>
    </>
  );
}
