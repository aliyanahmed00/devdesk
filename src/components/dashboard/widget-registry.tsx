import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Code2,
  Gauge,
  KanbanSquare,
  Music2,
  NotebookPen,
  SquareTerminal,
  StickyNote,
  Timer,
} from "lucide-react";

import { GithubWidget } from "@/components/widgets/github-widget";
import { GithubVercelFeed } from "@/components/widgets/github-vercel-feed";
import { LofiWidget } from "@/components/widgets/lofi-widget";
import { NotesWidget } from "@/components/widgets/notes-widget";
import { PomodoroWidget } from "@/components/widgets/pomodoro-widget";
import { ResourceMonitorWidget } from "@/components/widgets/resource-monitor-widget";
import { ScratchpadWidget } from "@/components/widgets/scratchpad-widget";
import { SnippetsWidget } from "@/components/widgets/snippets-widget";
import { TaskBoardWidget } from "@/components/widgets/task-board-widget";
import { TerminalWidget } from "@/components/widgets/terminal-widget";

export type WidgetId =
  | "notes"
  | "pomodoro"
  | "task-board"
  | "snippets"
  | "lofi"
  | "terminal"
  | "github"
  | "github-feed"
  | "scratchpad"
  | "resource-monitor";

export type WidgetAccent =
  | "indigo"
  | "amber"
  | "emerald"
  | "violet"
  | "sky"
  | "teal"
  | "cyan"
  | "rose"
  | "zinc";

export type WidgetCategory = "productivity" | "developer" | "audio";

export type WidgetCategoryFilter = WidgetCategory | "all";

export const WIDGET_CATEGORY_LABEL: Record<WidgetCategory, string> = {
  productivity: "Productivity",
  developer: "Developer Tools",
  audio: "Audio & Utilities",
};

export const WIDGET_CATEGORIES: { id: WidgetCategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "productivity", label: "Productivity" },
  { id: "developer", label: "Developer Tools" },
  { id: "audio", label: "Audio & Utilities" },
];

export type WidgetDefinition = {
  id: WidgetId;
  title: string;
  description: string;
  tag: string;
  accent: WidgetAccent;
  category: WidgetCategory;
  icon: LucideIcon;
  span: string;
  defaultEnabled: boolean;
  component: ComponentType;
};

export const WIDGETS: WidgetDefinition[] = [
  {
    id: "notes",
    title: "Notes",
    description: "Markdown scratchpad with live preview.",
    tag: "Markdown",
    accent: "violet",
    category: "productivity",
    icon: StickyNote,
    span: "lg:col-span-7",
    defaultEnabled: true,
    component: NotesWidget,
  },
  {
    id: "pomodoro",
    title: "Pomodoro",
    description: "Focus timer with goals, weekly activity heatmap and session analytics.",
    tag: "Timer",
    accent: "amber",
    category: "productivity",
    icon: Timer,
    span: "lg:col-span-5",
    defaultEnabled: true,
    component: PomodoroWidget,
  },
  {
    id: "task-board",
    title: "Task Board",
    description: "Drag-and-drop kanban columns.",
    tag: "Kanban",
    accent: "emerald",
    category: "productivity",
    icon: KanbanSquare,
    span: "lg:col-span-7",
    defaultEnabled: true,
    component: TaskBoardWidget,
  },
  {
    id: "snippets",
    title: "Code Snippets",
    description: "Searchable snippet library with tags and a live JS/TS sandbox.",
    tag: "Sandbox",
    accent: "indigo",
    category: "developer",
    icon: Code2,
    span: "lg:col-span-5",
    defaultEnabled: true,
    component: SnippetsWidget,
  },
  {
    id: "lofi",
    title: "Lofi & Ambient Sound",
    description:
      "Stream lofi, synthwave and ambient channels with a live mixer and waveform.",
    tag: "Ambient",
    accent: "sky",
    category: "audio",
    icon: Music2,
    span: "lg:col-span-6",
    defaultEnabled: false,
    component: LofiWidget,
  },
  {
    id: "terminal",
    title: "Terminal Commands",
    description: "Retro CLI quick-sheet of pinned commands.",
    tag: "Shell",
    accent: "cyan",
    category: "developer",
    icon: SquareTerminal,
    span: "lg:col-span-6",
    defaultEnabled: false,
    component: TerminalWidget,
  },
  {
    id: "github",
    title: "GitHub Activity",
    description: "Live profile stats and recent public events.",
    tag: "Profile",
    accent: "zinc",
    category: "developer",
    icon: Activity,
    span: "lg:col-span-6",
    defaultEnabled: false,
    component: GithubWidget,
  },
  {
    id: "github-feed",
    title: "GitHub & Vercel Feed",
    description:
      "Live commit, PR and issue streams plus deployment telemetry with streaming build logs.",
    tag: "Activity",
    accent: "sky",
    category: "developer",
    icon: Activity,
    span: "lg:col-span-12",
    defaultEnabled: false,
    component: GithubVercelFeed,
  },
  {
    id: "scratchpad",
    title: "Scratchpad",
    description: "Dual-tab scratchpad and dev calculator.",
    tag: "Utility",
    accent: "rose",
    category: "audio",
    icon: NotebookPen,
    span: "lg:col-span-6",
    defaultEnabled: false,
    component: ScratchpadWidget,
  },
  {
    id: "resource-monitor",
    title: "Resource Monitor",
    description: "Live CPU, memory, latency & frame-rate telemetry.",
    tag: "Telemetry",
    accent: "teal",
    category: "developer",
    icon: Gauge,
    span: "lg:col-span-6",
    defaultEnabled: false,
    component: ResourceMonitorWidget,
  },
];

export function getWidget(id: WidgetId) {
  return WIDGETS.find((widget) => widget.id === id);
}
