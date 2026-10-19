"use client";

import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import {
  ArrowUpDown,
  Calendar,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  GripVertical,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import { clsx } from "clsx";

import { Modal } from "@/components/ui/modal";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useNow } from "@/lib/relative-time";
import { useWidgetAction } from "@/lib/widget-actions";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ColumnId = "todo" | "in-progress" | "review" | "done";

export type Priority = "low" | "medium" | "high" | "urgent";

export type SubTask = { id: string; title: string; done: boolean };

export type Task = {
  id: string;
  title: string;
  priority: Priority;
  assignee?: string;
  due?: string;
  subtasks: SubTask[];
  createdAt: number;
  completedAt?: number;
};

export type Board = Record<ColumnId, Task[]>;

export type TaskSort = "manual" | "priority" | "due" | "created" | "title";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const COLUMNS: { id: ColumnId; label: string; dot: string }[] = [
  { id: "todo", label: "To Do", dot: "bg-slate-400" },
  { id: "in-progress", label: "In Progress", dot: "bg-amber-400" },
  { id: "review", label: "Review", dot: "bg-violet-400" },
  { id: "done", label: "Done", dot: "bg-emerald-400" },
];

export const COLUMN_ORDER: ColumnId[] = [
  "todo",
  "in-progress",
  "review",
  "done",
];

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low"];

export const PRIORITY_META: Record<
  Priority,
  { label: string; badge: string; dot: string; rank: number }
> = {
  urgent: {
    label: "Urgent",
    badge: "bg-rose-500/15 text-rose-400 ring-rose-400/30",
    dot: "bg-rose-400",
    rank: 3,
  },
  high: {
    label: "High",
    badge: "bg-amber-500/15 text-amber-400 ring-amber-400/30",
    dot: "bg-amber-400",
    rank: 2,
  },
  medium: {
    label: "Medium",
    badge: "bg-sky-500/15 text-sky-400 ring-sky-400/30",
    dot: "bg-sky-400",
    rank: 1,
  },
  low: {
    label: "Low",
    badge: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/25",
    dot: "bg-zinc-400",
    rank: 0,
  },
};

export const ASSIGNEES: {
  id: string;
  name: string;
  initials: string;
  color: string;
}[] = [
  {
    id: "you",
    name: "You",
    initials: "YO",
    color: "bg-indigo-500/20 text-indigo-300 ring-indigo-400/30",
  },
  {
    id: "ara",
    name: "Ara Voss",
    initials: "AV",
    color: "bg-emerald-500/20 text-emerald-300 ring-emerald-400/30",
  },
  {
    id: "max",
    name: "Max Lin",
    initials: "ML",
    color: "bg-amber-500/20 text-amber-300 ring-amber-400/30",
  },
  {
    id: "rin",
    name: "Rin Sato",
    initials: "RS",
    color: "bg-rose-500/20 text-rose-300 ring-rose-400/30",
  },
  {
    id: "sam",
    name: "Sam Reid",
    initials: "SR",
    color: "bg-sky-500/20 text-sky-300 ring-sky-400/30",
  },
];

export const SORT_OPTIONS: { id: TaskSort; label: string }[] = [
  { id: "manual", label: "Manual order" },
  { id: "priority", label: "Priority" },
  { id: "due", label: "Due date" },
  { id: "created", label: "Newest first" },
  { id: "title", label: "Title A–Z" },
];

export const TASK_BOARD_STORAGE_KEY = "devdesk:tasks";
export const TASK_BOARD_PREFS_KEY = "devdesk:task-board-prefs";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const INITIAL_BOARD: Board = {
  todo: [
    {
      id: "t1",
      title: "Design the auth flow",
      priority: "high",
      assignee: "you",
      due: "2026-11-04",
      subtasks: [
        { id: "s1", title: "Wireframe screens", done: true },
        { id: "s2", title: "Auth state machine", done: false },
      ],
      createdAt: 0,
    },
    {
      id: "t2",
      title: "Audit color contrast",
      priority: "medium",
      assignee: "ara",
      subtasks: [],
      createdAt: 0,
    },
  ],
  "in-progress": [
    {
      id: "t3",
      title: "Build the widget grid",
      priority: "urgent",
      assignee: "max",
      due: "2026-10-28",
      subtasks: [
        { id: "s3", title: "Drag handles", done: true },
        { id: "s4", title: "Drop zones", done: true },
        { id: "s5", title: "Persist order", done: false },
      ],
      createdAt: 0,
    },
  ],
  review: [
    {
      id: "t5",
      title: "Refactor storage layer",
      priority: "low",
      assignee: "rin",
      subtasks: [{ id: "s7", title: "Typed helpers", done: false }],
      createdAt: 0,
    },
  ],
  done: [
    {
      id: "t4",
      title: "Scaffold the Next.js app",
      priority: "high",
      assignee: "you",
      subtasks: [{ id: "s6", title: "App router", done: true }],
      createdAt: 0,
      completedAt: 0,
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTask(title: string, patch: Partial<Task> = {}): Task {
  return {
    id: genId(),
    title,
    priority: "medium",
    subtasks: [],
    createdAt: Date.now(),
    ...patch,
  };
}

function isPriority(value: unknown): value is Priority {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "urgent"
  );
}

function normalizeSubtask(value: unknown, fallbackId: string): SubTask | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== "string") return null;
  return {
    id: typeof raw.id === "string" ? raw.id : fallbackId,
    title: raw.title,
    done: raw.done === true,
  };
}

function normalizeTask(
  value: unknown,
  fallbackId: string,
): Task | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== "string") return null;

  const subtasks = Array.isArray(raw.subtasks)
    ? raw.subtasks
        .map((item, index) => normalizeSubtask(item, `${fallbackId}-s${index}`))
        .filter((item): item is SubTask => item !== null)
    : [];

  return {
    id: typeof raw.id === "string" ? raw.id : fallbackId,
    title: raw.title,
    priority: isPriority(raw.priority) ? raw.priority : "medium",
    assignee: typeof raw.assignee === "string" ? raw.assignee : undefined,
    due: typeof raw.due === "string" ? raw.due : undefined,
    subtasks,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
    completedAt:
      typeof raw.completedAt === "number" ? raw.completedAt : undefined,
  };
}

/** Coerce any stored value (including legacy 3-column boards) into a Board. */
export function normalizeBoard(value: unknown): Board {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const result = {} as Board;
  for (const id of COLUMN_ORDER) {
    const list = Array.isArray(source[id]) ? (source[id] as unknown[]) : [];
    result[id] = list
      .map((item, index) => normalizeTask(item, `${id}-${index}`))
      .filter((item): item is Task => item !== null);
  }
  return result;
}

export function assigneeById(id: string | undefined) {
  if (!id) return null;
  return ASSIGNEES.find((person) => person.id === id) ?? null;
}

export function formatDueDate(due: string): string {
  const parts = due.split("-");
  if (parts.length !== 3) return due;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day || month < 1 || month > 12) return due;
  return `${MONTHS[month - 1]} ${day}`;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type DueStatus = "overdue" | "today" | "soon" | "later" | "none";

export function dueStatus(due: string | undefined, now: number): DueStatus {
  if (!due || !now) return "none";
  const today = toDateInputValue(new Date(now));
  if (due < today) return "overdue";
  if (due === today) return "today";
  const soon = toDateInputValue(new Date(now + 2 * 86_400_000));
  if (due <= soon) return "soon";
  return "later";
}

function matchesQuery(task: Task, query: string): boolean {
  if (!query) return true;
  const assignee = assigneeById(task.assignee)?.name ?? "";
  const haystack = `${task.title} ${assignee} ${task.subtasks
    .map((sub) => sub.title)
    .join(" ")}`.toLowerCase();
  return haystack.includes(query);
}

function sortTasks(list: Task[], sort: TaskSort): Task[] {
  if (sort === "manual") return list;
  const copy = [...list];
  if (sort === "priority") {
    copy.sort((a, b) => {
      const diff = PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank;
      return diff !== 0 ? diff : b.createdAt - a.createdAt;
    });
  } else if (sort === "due") {
    copy.sort((a, b) => {
      if (!a.due && !b.due) return b.createdAt - a.createdAt;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
    });
  } else if (sort === "created") {
    copy.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sort === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  return copy;
}

/* -------------------------------------------------------------------------- */
/* Preferences                                                                */
/* -------------------------------------------------------------------------- */

type TaskBoardPrefs = { sort: TaskSort; priorities: Priority[] };

const DEFAULT_PREFS: TaskBoardPrefs = { sort: "manual", priorities: [] };

function normalizePrefs(value: unknown): TaskBoardPrefs {
  if (!value || typeof value !== "object") return DEFAULT_PREFS;
  const raw = value as Record<string, unknown>;
  const sort = SORT_OPTIONS.some((option) => option.id === raw.sort)
    ? (raw.sort as TaskSort)
    : "manual";
  const priorities = Array.isArray(raw.priorities)
    ? (raw.priorities.filter(isPriority) as Priority[])
    : [];
  return { sort, priorities };
}

/* -------------------------------------------------------------------------- */
/* Presentational pieces                                                      */
/* -------------------------------------------------------------------------- */

function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
        meta.badge,
      )}
    >
      <span className={clsx("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function DueChip({ due, now }: { due?: string; now: number }) {
  if (!due) return null;
  const status = dueStatus(due, now);
  const tone =
    status === "overdue"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
      : status === "today" || status === "soon"
        ? "border-amber-400/25 bg-amber-500/10 text-amber-300"
        : "border-border bg-muted/40 text-muted-foreground";
  const Icon = status === "overdue" ? TriangleAlert : Calendar;
  return (
    <span
      title={`Due ${due}`}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        tone,
      )}
    >
      <Icon className="size-3" />
      {formatDueDate(due)}
    </span>
  );
}

function Avatar({
  assignee,
  className,
}: {
  assignee?: string;
  className?: string;
}) {
  const meta = assigneeById(assignee);
  if (!meta) {
    return (
      <span
        title="Unassigned"
        className={clsx(
          "flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground",
          className,
        )}
      >
        <User className="size-3" />
      </span>
    );
  }
  return (
    <span
      title={meta.name}
      className={clsx(
        "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset",
        meta.color,
        className,
      )}
    >
      {meta.initials}
    </span>
  );
}

function SubtaskProgress({ task }: { task: Task }) {
  const total = task.subtasks.length;
  if (total === 0) return null;
  const done = task.subtasks.filter((sub) => sub.done).length;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ListChecks className="size-3" />
          {done}/{total}
        </span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-300",
            pct === 100 ? "bg-emerald-400" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DropLine() {
  return (
    <div className="h-0.5 rounded-full bg-primary shadow-[0_0_8px_rgb(var(--glow)/0.8)]" />
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "rose" | "emerald";
}) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] font-semibold tracking-wider text-zinc-400 uppercase">
        {label}
      </span>
      <span
        className={clsx(
          "text-sm font-semibold tabular-nums",
          tone === "rose"
            ? "text-rose-400"
            : tone === "emerald"
              ? "text-emerald-400"
              : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Task card                                                                  */
/* -------------------------------------------------------------------------- */

type TaskCardProps = {
  task: Task;
  column: ColumnId;
  index: number;
  now: number;
  columnIndex: number;
  dragging: boolean;
  canReorder: boolean;
  onDragStart: (event: DragEvent<HTMLElement>, task: Task, column: ColumnId) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>, column: ColumnId, index: number) => void;
  onEdit: (task: Task, column: ColumnId) => void;
  onDelete: (task: Task, column: ColumnId) => void;
  onMove: (task: Task, column: ColumnId, direction: -1 | 1) => void;
};

function TaskCard({
  task,
  column,
  index,
  now,
  columnIndex,
  dragging,
  canReorder,
  onDragStart,
  onDragEnd,
  onDragOver,
  onEdit,
  onDelete,
  onMove,
}: TaskCardProps) {
  const complete = column === "done";
  return (
    <article
      draggable
      onDragStart={(event) => onDragStart(event, task, column)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, column, index)}
      className={clsx(
        "group/card cursor-grab rounded-lg border border-border bg-card p-2.5 text-sm text-card-foreground shadow-sm transition-colors hover:border-primary/40 active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-1.5">
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />
        <PriorityBadge priority={task.priority} />
        <div className="ml-auto flex items-center gap-1">
          <DueChip due={task.due} now={now} />
          <button
            type="button"
            onClick={() => onEdit(task, column)}
            aria-label="Edit task"
            title="Edit task"
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task, column)}
            aria-label="Delete task"
            title="Delete task"
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-muted hover:text-rose-400 sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      <p
        className={clsx(
          "mt-1.5 leading-snug",
          complete && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </p>

      <SubtaskProgress task={task} />

      <div className="mt-2 flex items-center justify-between gap-2">
        <Avatar assignee={task.assignee} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={columnIndex === 0}
            onClick={() => onMove(task, column, -1)}
            aria-label="Move to previous column"
            title="Move left"
            className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={columnIndex === COLUMN_ORDER.length - 1}
            onClick={() => onMove(task, column, 1)}
            aria-label="Move to next column"
            title="Move right"
            className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {!canReorder && (
        <p className="mt-1 text-right text-[9px] text-muted-foreground/60">
          drag to move
        </p>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Task editor                                                                */
/* -------------------------------------------------------------------------- */

type TaskEditorProps = {
  task: Task;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
};

function TaskEditor({ task, onSave, onDelete, onClose }: TaskEditorProps) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [due, setDue] = useState(task.due ?? "");
  const [subtasks, setSubtasks] = useState<SubTask[]>(task.subtasks);
  const [newSub, setNewSub] = useState("");

  const done = subtasks.filter((sub) => sub.done).length;
  const pct = subtasks.length
    ? Math.round((done / subtasks.length) * 100)
    : 0;

  function addSubtask() {
    const value = newSub.trim();
    if (!value) return;
    setSubtasks((current) => [
      ...current,
      { id: genId(), title: value, done: false },
    ]);
    setNewSub("");
  }

  function save() {
    onSave({
      title: title.trim() || task.title,
      priority,
      assignee: assignee || undefined,
      due: due || undefined,
      subtasks,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
          Title
        </span>
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
          placeholder="Task title"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
          Priority
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITY_ORDER.map((id) => {
            const meta = PRIORITY_META[id];
            const active = priority === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPriority(id)}
                aria-pressed={active}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                  active
                    ? meta.badge
                    : "text-muted-foreground ring-border hover:bg-muted",
                )}
              >
                <span className={clsx("size-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Assignee
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAssignee("")}
              aria-pressed={assignee === ""}
              title="Unassigned"
              className={clsx(
                "flex size-8 items-center justify-center rounded-full border border-dashed text-muted-foreground transition-colors",
                assignee === ""
                  ? "border-primary/60 ring-2 ring-primary/40"
                  : "border-border hover:bg-muted",
              )}
            >
              <User className="size-3.5" />
            </button>
            {ASSIGNEES.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setAssignee(person.id)}
                aria-pressed={assignee === person.id}
                title={person.name}
                className={clsx(
                  "flex size-8 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset transition-transform hover:scale-105",
                  person.color,
                  assignee === person.id && "ring-2 ring-primary/60",
                )}
              >
                {person.initials}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Due date
          </span>
          <input
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
          />
          {due && (
            <button
              type="button"
              onClick={() => setDue("")}
              className="self-start text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear date
            </button>
          )}
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Sub-tasks
          </span>
          {subtasks.length > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {done}/{subtasks.length} · {pct}%
            </span>
          )}
        </div>

        {subtasks.length > 0 && (
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-300",
                pct === 100 ? "bg-emerald-400" : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        <ul className="flex flex-col gap-1.5">
          {subtasks.map((sub) => (
            <li key={sub.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSubtasks((current) =>
                    current.map((item) =>
                      item.id === sub.id
                        ? { ...item, done: !item.done }
                        : item,
                    ),
                  )
                }
                aria-pressed={sub.done}
                aria-label={sub.done ? "Mark incomplete" : "Mark complete"}
                className={clsx(
                  "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                  sub.done
                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300"
                    : "border-border text-transparent hover:border-primary/50",
                )}
              >
                <Check className="size-3" />
              </button>
              <span
                className={clsx(
                  "flex-1 text-sm",
                  sub.done && "text-muted-foreground line-through",
                )}
              >
                {sub.title}
              </span>
              <button
                type="button"
                onClick={() =>
                  setSubtasks((current) =>
                    current.filter((item) => item.id !== sub.id),
                  )
                }
                aria-label="Remove sub-task"
                className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-rose-400"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <input
            value={newSub}
            onChange={(event) => setNewSub(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addSubtask();
              }
            }}
            placeholder="Add a sub-task…"
            className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
          />
          <button
            type="button"
            onClick={addSubtask}
            disabled={!newSub.trim()}
            className="btn-surface flex size-9 items-center justify-center rounded-lg disabled:opacity-40"
            aria-label="Add sub-task"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-2 rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-surface rounded-lg px-3 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Widget                                                                     */
/* -------------------------------------------------------------------------- */

export function TaskBoardWidget() {
  const now = useNow(60_000);

  const [storedBoard, setStoredBoard] = useLocalStorage<Board>(
    TASK_BOARD_STORAGE_KEY,
    INITIAL_BOARD,
  );
  const board = useMemo(() => normalizeBoard(storedBoard), [storedBoard]);

  const [storedPrefs, setStoredPrefs] = useLocalStorage<TaskBoardPrefs>(
    TASK_BOARD_PREFS_KEY,
    DEFAULT_PREFS,
  );
  const prefs = useMemo(() => normalizePrefs(storedPrefs), [storedPrefs]);

  const [query, setQuery] = useState("");
  const [drag, setDrag] = useState<{ taskId: string; from: ColumnId } | null>(
    null,
  );
  const [dropTarget, setDropTarget] = useState<{
    column: ColumnId;
    index: number;
  } | null>(null);
  const [addingIn, setAddingIn] = useState<ColumnId | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{
    column: ColumnId;
    taskId: string;
  } | null>(null);

  useWidgetAction("task:add", () => {
    setAddingIn("todo");
    setDraft("");
  });

  const updateBoard = useCallback(
    (mutator: (current: Board) => Board) => {
      setStoredBoard((prev) => normalizeBoard(mutator(normalizeBoard(prev))));
    },
    [setStoredBoard],
  );

  const updatePrefs = useCallback(
    (patch: Partial<TaskBoardPrefs>) => {
      setStoredPrefs((prev) =>
        normalizePrefs({ ...normalizePrefs(prev), ...patch }),
      );
    },
    [setStoredPrefs],
  );

  const search = query.trim().toLowerCase();
  const canReorder = prefs.sort === "manual" && !search && prefs.priorities.length === 0;

  const visible = useMemo(() => {
    const result = {} as Record<ColumnId, Task[]>;
    for (const { id } of COLUMNS) {
      let list = board[id];
      if (search) list = list.filter((task) => matchesQuery(task, search));
      if (prefs.priorities.length > 0) {
        list = list.filter((task) => prefs.priorities.includes(task.priority));
      }
      result[id] = sortTasks(list, prefs.sort);
    }
    return result;
  }, [board, prefs.priorities, prefs.sort, search]);

  const stats = useMemo(() => {
    const all = COLUMN_ORDER.flatMap((id) => board[id]);
    const total = all.length;
    const done = board.done.length;
    const overdue = all.filter(
      (task) => dueStatus(task.due, now) === "overdue",
    ).length;
    const active = COLUMN_ORDER.filter((id) => id !== "done").reduce(
      (sum, id) => sum + board[id].length,
      0,
    );
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, overdue, active, pct };
  }, [board, now]);

  const editingTask = useMemo(() => {
    if (!editing) return null;
    return board[editing.column].find((task) => task.id === editing.taskId) ?? null;
  }, [board, editing]);

  function moveTask(
    taskId: string,
    from: ColumnId,
    to: ColumnId,
    index: number | null,
  ) {
    updateBoard((current) => {
      const fromList = [...current[from]];
      const at = fromList.findIndex((task) => task.id === taskId);
      if (at === -1) return current;
      const [task] = fromList.splice(at, 1);
      const toList = from === to ? fromList : [...current[to]];

      let insertAt = index == null ? toList.length : index;
      if (from === to && at < insertAt) insertAt -= 1;
      insertAt = Math.max(0, Math.min(insertAt, toList.length));

      const enteredDone = to === "done" && from !== "done";
      const leftDone = from === "done" && to !== "done";
      const nextTask =
        enteredDone || leftDone
          ? { ...task, completedAt: enteredDone ? Date.now() : undefined }
          : task;

      toList.splice(insertAt, 0, nextTask);
      return { ...current, [from]: fromList, [to]: toList };
    });
  }

  function addTask(column: ColumnId, title: string) {
    const value = title.trim();
    if (!value) return;
    updateBoard((current) => ({
      ...current,
      [column]: [...current[column], createTask(value)],
    }));
  }

  function saveTask(column: ColumnId, taskId: string, patch: Partial<Task>) {
    updateBoard((current) => ({
      ...current,
      [column]: current[column].map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      ),
    }));
  }

  function removeTask(column: ColumnId, taskId: string) {
    updateBoard((current) => ({
      ...current,
      [column]: current[column].filter((task) => task.id !== taskId),
    }));
  }

  function togglePriorityFilter(priority: Priority) {
    updatePrefs({
      priorities: prefs.priorities.includes(priority)
        ? prefs.priorities.filter((item) => item !== priority)
        : [...prefs.priorities, priority],
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-8 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <label className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-muted-foreground">
            <ArrowUpDown className="size-3.5" />
            <select
              value={prefs.sort}
              onChange={(event) =>
                updatePrefs({ sort: event.target.value as TaskSort })
              }
              aria-label="Sort tasks"
              className="bg-transparent text-xs font-medium text-foreground outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => updatePrefs({ priorities: [] })}
            aria-pressed={prefs.priorities.length === 0}
            className={clsx(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              prefs.priorities.length === 0
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            All
          </button>
          {PRIORITY_ORDER.map((priority) => {
            const meta = PRIORITY_META[priority];
            const active = prefs.priorities.includes(priority);
            return (
              <button
                key={priority}
                type="button"
                onClick={() => togglePriorityFilter(priority)}
                aria-pressed={active}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  active
                    ? meta.badge.replace("ring-1 ring-inset", "").concat(" border-transparent")
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                <span className={clsx("size-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <Stat label="Total" value={stats.total} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Done" value={stats.done} tone="emerald" />
        <Stat
          label="Overdue"
          value={stats.overdue}
          tone={stats.overdue > 0 ? "rose" : "default"}
        />
        <div className="min-w-[110px] flex-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-mono tracking-wider uppercase">Progress</span>
            <span className="tabular-nums">{stats.pct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-1">
        {COLUMNS.map(({ id, label, dot }, index) => {
          const tasks = visible[id];
          const isTarget = dropTarget?.column === id;
          return (
            <div
              key={id}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget({ column: id, index: tasks.length });
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (drag) {
                  const target =
                    dropTarget && dropTarget.column === id
                      ? dropTarget.index
                      : tasks.length;
                  moveTask(drag.taskId, drag.from, id, canReorder ? target : null);
                }
                setDrag(null);
                setDropTarget(null);
              }}
              className={clsx(
                "flex min-h-48 min-w-[13.5rem] flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2.5 transition-colors",
                drag && isTarget && "border-primary/50 bg-primary/5",
                drag && !isTarget && "border-primary/20",
              )}
            >
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <span className={clsx("size-1.5 rounded-full", dot)} />
                  {label}
                </span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                  {tasks.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {tasks.map((task, taskIndex) => (
                  <Fragment key={task.id}>
                    {drag &&
                      isTarget &&
                      dropTarget?.index === taskIndex && <DropLine />}
                    <TaskCard
                      task={task}
                      column={id}
                      index={taskIndex}
                      now={now}
                      columnIndex={index}
                      dragging={drag?.taskId === task.id}
                      canReorder={canReorder}
                      onDragStart={(event, draggedTask, from) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", draggedTask.id);
                        setDrag({ taskId: draggedTask.id, from });
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setDropTarget(null);
                      }}
                      onDragOver={(event, targetColumn, targetIndex) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        const before = event.clientY < rect.top + rect.height / 2;
                        setDropTarget({
                          column: targetColumn,
                          index: before ? targetIndex : targetIndex + 1,
                        });
                      }}
                      onEdit={(item, column) =>
                        setEditing({ column, taskId: item.id })
                      }
                      onDelete={(item, column) =>
                        removeTask(column, item.id)
                      }
                      onMove={(item, column, direction) =>
                        moveTask(
                          item.id,
                          column,
                          COLUMN_ORDER[index + direction],
                          null,
                        )
                      }
                    />
                  </Fragment>
                ))}

                {drag && isTarget && dropTarget?.index === tasks.length && (
                  <DropLine />
                )}

                {tasks.length === 0 && !drag && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center text-muted-foreground/70">
                    <CircleDashed className="size-4" />
                    <span className="text-[11px]">
                      {prefs.sort !== "manual" || search || prefs.priorities.length
                        ? "No matching tasks"
                        : "Drop cards here"}
                    </span>
                  </div>
                )}
              </div>

              {addingIn === id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    addTask(id, draft);
                    setDraft("");
                  }}
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setAddingIn(null);
                        setDraft("");
                      }
                    }}
                    onBlur={() => {
                      if (draft.trim()) addTask(id, draft);
                      setAddingIn(null);
                      setDraft("");
                    }}
                    placeholder="Task title…"
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAddingIn(id);
                    setDraft("");
                  }}
                  className="flex min-h-9 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  Add a card
                </button>
              )}
            </div>
          );
        })}
      </div>

      {stats.total === 0 && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <CheckCheck className="size-3.5" />
          Board is empty — add your first card above.
        </p>
      )}

      <Modal
        open={editingTask !== null}
        onClose={() => setEditing(null)}
        title="Edit task"
      >
        {editingTask && editing && (
          <TaskEditor
            task={editingTask}
            onSave={(patch) => {
              saveTask(editing.column, editingTask.id, patch);
              setEditing(null);
            }}
            onDelete={() => {
              removeTask(editing.column, editingTask.id);
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
