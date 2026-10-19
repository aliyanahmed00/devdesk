"use client";

import { useMemo } from "react";
import {
  Code2,
  KanbanSquare,
  Plug,
  SquareTerminal,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

import type { WidgetId } from "@/components/dashboard/widget-registry";
import {
  DEFAULT_NOTES_STATE,
  NOTES_STORAGE_KEY,
  normalizeNotesState,
} from "@/lib/notes";
import {
  DEFAULT_SNIPPETS,
  type Snippet,
} from "@/components/widgets/snippets-widget";
import {
  COLUMNS,
  INITIAL_BOARD,
  type Board,
} from "@/components/widgets/task-board-widget";
import {
  DEFAULT_COMMANDS,
  type PinnedCommand,
} from "@/components/widgets/terminal-widget";
import {
  INTEGRATION_CATALOG,
  INTEGRATION_ORDER,
  INTEGRATIONS_STORAGE_KEY,
  createDefaultState,
  type IntegrationId,
  type IntegrationsState,
} from "@/lib/integrations";
import { useLocalStorage } from "@/lib/use-local-storage";

export type SearchKind =
  | "note"
  | "task"
  | "snippet"
  | "command"
  | "integration";

export type SearchResult = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  preview?: string;
  icon: LucideIcon;
  /** Widget to focus when the result is activated, when applicable. */
  widget?: WidgetId;
  /** Integration to open in the connect drawer, for integration results. */
  integration?: IntegrationId;
  haystack: string;
};

export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  note: "Notes",
  task: "Tasks",
  snippet: "Snippets",
  command: "Commands",
  integration: "Integrations",
};

const KIND_ICON: Record<SearchKind, LucideIcon> = {
  note: StickyNote,
  task: KanbanSquare,
  snippet: Code2,
  command: SquareTerminal,
  integration: Plug,
};

const DEFAULT_INTEGRATIONS = createDefaultState();

const INTEGRATION_STATUS_LABEL = {
  connected: "Connected",
  disconnected: "Disconnected",
  syncing: "Syncing",
} as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type NoteSection = {
  slug: string;
  title: string;
  body: string;
};

function parseNoteSections(markdown: string): NoteSection[] {
  const lines = markdown.split(/\r?\n/);
  const raw: { title: string; bodyLines: string[] }[] = [];
  let current = { title: "", bodyLines: [] as string[] };
  let inFence = false;

  const flush = () => {
    const body = current.bodyLines.join("\n").trim();
    if (current.title.trim() || body) raw.push(current);
    current = { title: "", bodyLines: [] };
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      current.bodyLines.push(line);
      continue;
    }
    if (!inFence) {
      const heading = /^#{1,6}\s+(.*)$/.exec(line);
      if (heading) {
        flush();
        current.title = heading[1].trim();
        continue;
      }
    }
    current.bodyLines.push(line);
  }
  flush();

  return raw.map((section, index) => ({
    slug: `${index}-${slugify(section.title) || "section"}`,
    title: section.title.trim() || "Scratchpad note",
    body: section.bodyLines.join("\n").trim(),
  }));
}

export function useGlobalSearchIndex(): SearchResult[] {
  const [noteState] = useLocalStorage<unknown>(
    NOTES_STORAGE_KEY,
    DEFAULT_NOTES_STATE,
  );
  const [board] = useLocalStorage<Board>("devdesk:tasks", INITIAL_BOARD);
  const [snippets] = useLocalStorage<Snippet[]>(
    "devdesk:snippets",
    DEFAULT_SNIPPETS,
  );
  const [commands] = useLocalStorage<PinnedCommand[]>(
    "devdesk:terminal",
    DEFAULT_COMMANDS,
  );
  const [integrations] = useLocalStorage<IntegrationsState>(
    INTEGRATIONS_STORAGE_KEY,
    DEFAULT_INTEGRATIONS,
  );

  return useMemo(() => {
    const results: SearchResult[] = [];

    const notes = normalizeNotesState(noteState);
    for (const doc of notes.docs) {
      const docLabel = doc.title.replace(/\.(md|markdown|txt)$/i, "");
      for (const section of parseNoteSections(doc.content)) {
        results.push({
          id: `note-${doc.id}-${section.slug}`,
          kind: "note",
          title: section.title,
          subtitle: `Note · ${docLabel}`,
          preview: stripMarkdown(section.body).slice(0, 120),
          icon: KIND_ICON.note,
          widget: "notes",
          haystack: `${docLabel} ${section.title} ${stripMarkdown(section.body)}`.toLowerCase(),
        });
      }
    }

    for (const column of COLUMNS) {
      for (const task of board[column.id] ?? []) {
        results.push({
          id: `task-${task.id}`,
          kind: "task",
          title: task.title,
          subtitle: `Task · ${column.label}`,
          preview: `Column: ${column.label}`,
          icon: KIND_ICON.task,
          widget: "task-board",
          haystack: `${task.title} ${column.label} task`.toLowerCase(),
        });
      }
    }

    for (const snippet of snippets) {
      results.push({
        id: `snippet-${snippet.id}`,
        kind: "snippet",
        title: snippet.title,
        subtitle: `Snippet · ${snippet.language}`,
        preview:
          snippet.description?.trim() ||
          snippet.code.split("\n")[0]?.trim() ||
          "",
        icon: KIND_ICON.snippet,
        widget: "snippets",
        haystack: `${snippet.title} ${snippet.language} ${snippet.description ?? ""} ${(snippet.tags ?? []).join(" ")} ${snippet.code}`.toLowerCase(),
      });
    }

    for (const command of commands) {
      results.push({
        id: `command-${command.id}`,
        kind: "command",
        title: command.label,
        subtitle: `Command · ${command.category}`,
        preview: command.command,
        icon: KIND_ICON.command,
        widget: "terminal",
        haystack: `${command.label} ${command.command} ${command.category} cli alias`.toLowerCase(),
      });
    }

    for (const id of INTEGRATION_ORDER) {
      const definition = INTEGRATION_CATALOG[id];
      const connection = integrations?.connections?.[id];
      const status = connection?.status ?? "disconnected";
      results.push({
        id: `integration-${id}`,
        kind: "integration",
        title: definition.name,
        subtitle: `Integration · ${INTEGRATION_STATUS_LABEL[status]}`,
        preview: definition.description,
        icon: KIND_ICON.integration,
        integration: id,
        haystack: `${definition.name} ${definition.category} ${definition.description} ${status} integration connect`.toLowerCase(),
      });
    }

    return results;
  }, [noteState, board, snippets, commands, integrations]);
}
