"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Focus,
  ListChecks,
  NotebookPen,
  Play,
  Sparkles,
  Timer,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

import { useToast } from "@/components/providers/toast-provider";
import { useLocalStorage } from "@/lib/use-local-storage";
import { emitWidgetAction } from "@/lib/widget-actions";
import { useNow } from "@/lib/relative-time";
import { PomodoroWidget } from "@/components/widgets/pomodoro-widget";
import { ScratchpadWidget } from "@/components/widgets/scratchpad-widget";
import {
  assigneeById,
  dueStatus,
  formatDueDate,
  INITIAL_BOARD,
  normalizeBoard,
  PRIORITY_META,
  TASK_BOARD_STORAGE_KEY,
  type Board,
  type ColumnId,
} from "@/components/widgets/task-board-widget";

export const FOCUS_AMBIENT_KEY = "devdesk:focus-ambient";

const DUE_STYLE: Record<string, string> = {
  overdue: "text-rose-400",
  today: "text-amber-400",
  soon: "text-sky-400",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
};

function FocusPanel({
  title,
  tag,
  icon: Icon,
  children,
}: {
  title: string;
  tag: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="glass card-rim flex h-full flex-col overflow-hidden rounded-2xl">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col leading-none">
          <h2 className="truncate text-sm font-semibold tracking-tight">
            {title}
          </h2>
          <span className="mt-1 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            {tag}
          </span>
        </div>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function ActiveTaskCard() {
  const [storedBoard, setStoredBoard] = useLocalStorage<Board>(
    TASK_BOARD_STORAGE_KEY,
    INITIAL_BOARD,
  );
  const board = useMemo(() => normalizeBoard(storedBoard), [storedBoard]);
  const { toast } = useToast();
  const now = useNow(30_000);
  const [cursor, setCursor] = useState(0);

  const active = useMemo(
    () => [
      ...board["in-progress"],
      ...board.review,
      ...board.todo,
    ],
    [board],
  );
  const task = active.length > 0 ? active[cursor % active.length] : null;

  const remaining =
    board["in-progress"].length + board.review.length + board.todo.length;

  function completeTask() {
    if (!task) return;
    setStoredBoard((current) => {
      const next = normalizeBoard(current);
      const column = (
        ["in-progress", "review", "todo"] as ColumnId[]
      ).find((id) => next[id].some((item) => item.id === task.id));
      if (!column) return next;
      return {
        ...next,
        [column]: next[column].filter((item) => item.id !== task.id),
        done: [...next.done, { ...task, completedAt: Date.now() }],
      };
    });
    toast(`Completed: ${task.title}`, "success");
  }

  function focusTask() {
    if (!task) return;
    emitWidgetAction("pomodoro:start");
    toast(`Focusing on: ${task.title}`, "info");
  }

  if (!task) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center">
        <Check className="size-6 text-emerald-400" />
        <p className="text-sm font-medium text-foreground">
          Inbox zero — nothing active.
        </p>
        <p className="text-xs text-muted-foreground">
          Your board is clear. Enjoy the calm.
        </p>
      </div>
    );
  }

  const priority = PRIORITY_META[task.priority];
  const assignee = assigneeById(task.assignee);
  const doneSubtasks = task.subtasks.filter((item) => item.done).length;
  const due = task.due ? dueStatus(task.due, now) : "none";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
            priority.badge,
          )}
        >
          <span className={clsx("size-1.5 rounded-full", priority.dot)} />
          {priority.label}
        </span>
        {task.due && (
          <span
            className={clsx(
              "text-[11px] font-medium tabular-nums",
              DUE_STYLE[due],
            )}
          >
            Due {formatDueDate(task.due)}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-lg leading-snug font-semibold tracking-tight text-foreground">
          {task.title}
        </h3>
        {assignee && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Assigned to{" "}
            <span className="font-medium text-foreground">{assignee.name}</span>
          </p>
        )}
      </div>

      {task.subtasks.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Subtasks</span>
            <span className="tabular-nums">
              {doneSubtasks} / {task.subtasks.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
              style={{
                width: `${(doneSubtasks / task.subtasks.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={focusTask}
          data-sound="pop"
          className="btn-primary flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium"
        >
          <Play className="size-3.5" />
          Focus on this
        </button>
        <button
          type="button"
          onClick={completeTask}
          data-sound="chime"
          className="btn-surface flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium"
        >
          <Check className="size-3.5" />
          Complete
        </button>
      </div>

      {active.length > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>
            {(cursor % active.length) + 1} of {active.length} active
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setCursor((value) => (value - 1 + active.length) % active.length)
              }
              className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCursor((value) => (value + 1) % active.length)}
              className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Next
            </button>
          </div>
          <span>{remaining} remaining</span>
        </div>
      )}
    </div>
  );
}

export function FocusOverlay({
  open,
  onExit,
}: {
  open: boolean;
  onExit: () => void;
}) {
  const [rendered, setRendered] = useState(open);
  const [ambient, setAmbient] = useLocalStorage<boolean>(FOCUS_AMBIENT_KEY, true);

  useEffect(() => {
    const id = window.setTimeout(() => setRendered(open), open ? 0 : 420);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!rendered) return null;

  return (
    <div
      aria-hidden={!open}
      className={clsx(
        "fixed inset-0 z-40 overflow-y-auto bg-background/95 backdrop-blur-xl transition-opacity duration-500",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {ambient && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 overflow-hidden"
        >
          <div className="zenith-aurora absolute inset-[-10%]" />
          <div className="zenith-pulse absolute left-1/2 top-1/3 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10" />
          <div
            className="zenith-pulse absolute right-[12%] bottom-[10%] size-64 rounded-full border border-primary/10"
            style={{ animationDelay: "1.6s" }}
          />
        </div>
      )}

      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-5 lg:px-8">
        <header className="animate-fade-in flex flex-wrap items-center justify-between gap-3 rounded-full border border-border/70 bg-background/70 px-4 py-2 backdrop-blur-md">
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Focus className="size-3.5 text-primary" />
            Zenith Focus Mode
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAmbient((value) => !value)}
              aria-pressed={ambient}
              data-sound="pop"
              title="Toggle ambient background"
              className={clsx(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                ambient
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {ambient ? (
                <Sparkles className="size-3.5" />
              ) : (
                <Waves className="size-3.5" />
              )}
              Ambient
            </button>
            <button
              type="button"
              onClick={onExit}
              data-sound="swoosh"
              className="btn-surface flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
            >
              Exit Focus Mode
              <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] font-medium">
              Esc
            </kbd>
          </button>
        </div>
        </header>

        <div className="animate-fade-in grid flex-1 content-start gap-5 py-6 lg:grid-cols-3">
          <FocusPanel title="Pomodoro" tag="Timer" icon={Timer}>
            <PomodoroWidget />
          </FocusPanel>
          <FocusPanel title="Active task" tag="Focus" icon={ListChecks}>
            <ActiveTaskCard />
          </FocusPanel>
          <FocusPanel title="Scratchpad" tag="Notes" icon={NotebookPen}>
            <ScratchpadWidget />
          </FocusPanel>
        </div>

        <footer className="pb-2 text-center text-[11px] text-muted-foreground">
          Zenith Focus Mode — press{" "}
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>{" "}
          to return to your workspace.
        </footer>
      </div>
    </div>
  );
}
