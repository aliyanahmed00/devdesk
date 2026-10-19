export type NoteDoc = {
  id: string;
  title: string;
  content: string;
};

export type NotesState = {
  docs: NoteDoc[];
  activeId: string;
};

export const NOTES_STORAGE_KEY = "devdesk:notes";
export const NOTES_PREFS_KEY = "devdesk:notes-prefs";
export const NOTES_HISTORY_KEY = "devdesk:notes-history";

export type NotesViewMode = "split" | "edit" | "preview";

export type NotesPrefs = {
  viewMode: NotesViewMode;
};

export const DEFAULT_NOTES_PREFS: NotesPrefs = { viewMode: "split" };

export type NoteHistoryEntry = { content: string; at: number };

export type DocHistory = {
  entries: NoteHistoryEntry[];
  index: number;
};

export type NotesHistory = Record<string, DocHistory>;

export const NOTES_HISTORY_LIMIT = 60;

export const SPRINT_NOTE = `# Sprint note

A quick scratchpad for the **DevDesk** workspace.

## Focus this week

- [x] Ship the widget grid
- [ ] Wire up keyboard shortcuts
- [ ] Polish empty states

> Tip: notes render \`inline code\` and fenced blocks.

\`\`\`ts
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
\`\`\`
`;

export const API_DRAFT = `# API Draft

## Endpoints

- [ ] \`GET /api/tasks\` — list tasks
- [ ] \`POST /api/tasks\` — create a task
- [ ] \`PATCH /api/tasks/:id\` — update status

> Status codes: \`200\`, \`201\`, \`400\`, \`404\`.

See the [REST guidelines](https://restfulapi.net) for naming conventions.
`;

export const QUICK_SCRATCHPAD = `# Quick scratchpad

- grep -rn "TODO" src/
- docker compose up -d
- pnpm dlx next build
`;

export const DEFAULT_NOTE_DOCS: NoteDoc[] = [
  { id: "sprint-notes", title: "Sprint Notes.md", content: SPRINT_NOTE },
  { id: "api-draft", title: "API Draft.md", content: API_DRAFT },
  {
    id: "quick-scratchpad",
    title: "Quick Scratchpad.md",
    content: QUICK_SCRATCHPAD,
  },
];

export const DEFAULT_NOTES_STATE: NotesState = {
  docs: DEFAULT_NOTE_DOCS,
  activeId: "sprint-notes",
};

export const VIEW_MODES: readonly NotesViewMode[] = [
  "split",
  "edit",
  "preview",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function ensureMarkdownName(title: string): string {
  const clean = title.trim();
  if (!clean) return "Untitled.md";
  return /\.(md|markdown|txt)$/i.test(clean) ? clean : `${clean}.md`;
}

export function noteDisplayTitle(title: string): string {
  return title.replace(/\.(md|markdown|txt)$/i, "");
}

export function normalizeViewMode(value: unknown): NotesViewMode {
  return value === "edit" || value === "preview" || value === "split"
    ? value
    : DEFAULT_NOTES_PREFS.viewMode;
}

export function normalizePrefs(value: unknown): NotesPrefs {
  if (isRecord(value)) {
    return { viewMode: normalizeViewMode(value.viewMode) };
  }
  return DEFAULT_NOTES_PREFS;
}

export function normalizeNotesState(input: unknown): NotesState {
  if (typeof input === "string") {
    return {
      docs: [
        { id: "sprint-notes", title: "Sprint Notes.md", content: input },
        DEFAULT_NOTE_DOCS[1],
        DEFAULT_NOTE_DOCS[2],
      ],
      activeId: "sprint-notes",
    };
  }

  if (isRecord(input) && Array.isArray(input.docs)) {
    const docs: NoteDoc[] = [];
    const seen = new Set<string>();
    input.docs.forEach((raw, index) => {
      if (!isRecord(raw)) return;
      const id =
        typeof raw.id === "string" && raw.id.trim() ? raw.id : `note-${index}`;
      if (seen.has(id)) return;
      seen.add(id);
      docs.push({
        id,
        title:
          typeof raw.title === "string" && raw.title.trim()
            ? raw.title
            : "Untitled.md",
        content: typeof raw.content === "string" ? raw.content : "",
      });
    });

    if (docs.length > 0) {
      const activeRaw = input.activeId;
      const activeId =
        typeof activeRaw === "string" && docs.some((doc) => doc.id === activeRaw)
          ? activeRaw
          : docs[0].id;
      return { docs, activeId };
    }
  }

  return { docs: [...DEFAULT_NOTE_DOCS], activeId: DEFAULT_NOTES_STATE.activeId };
}

export function emptyNotesState(): NotesState {
  const doc: NoteDoc = { id: "scratchpad", title: "Scratchpad.md", content: "" };
  return { docs: [doc], activeId: doc.id };
}

export function createNoteDoc(title?: string): NoteDoc {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: ensureMarkdownName(title?.trim() || "Untitled"),
    content: "",
  };
}

export function appendToActiveNote(state: NotesState, text: string): NotesState {
  const normalized = normalizeNotesState(state);
  const trimmed = text.trim();
  if (!trimmed) return normalized;
  return {
    ...normalized,
    docs: normalized.docs.map((doc) =>
      doc.id === normalized.activeId
        ? { ...doc, content: `${doc.content.trimEnd()}\n\n${trimmed}` }
        : doc,
    ),
  };
}
