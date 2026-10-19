"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  Eraser,
  Hash,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";

import { Modal } from "@/components/ui/modal";
import { CodeBlock } from "@/components/ui/code-block";
import { useToast } from "@/components/providers/toast-provider";
import { runJavaScript, type SandboxLog } from "@/lib/sandbox";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useWidgetAction } from "@/lib/widget-actions";

export type Snippet = {
  id: string;
  title: string;
  language: string;
  code: string;
  tags?: string[];
  description?: string;
};

export const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: "debounce",
    title: "Debounce",
    language: "TypeScript",
    tags: ["utility", "hooks"],
    description: "Delay a function until after wait ms of silence since the last call.",
    code: `function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait = 300,
) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}`,
  },
  {
    id: "fetch-json",
    title: "Fetch JSON",
    language: "TypeScript",
    tags: ["network", "utility"],
    description: "Typed fetch wrapper that throws on non-2xx responses.",
    code: `async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<T>;
}`,
  },
  {
    id: "cn",
    title: "Class names helper",
    language: "TypeScript",
    tags: ["utility", "ui"],
    description: "Merge conditional class names with clsx.",
    code: `import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}`,
  },
  {
    id: "chunk",
    title: "Chunk array",
    language: "JavaScript",
    tags: ["utility", "javascript"],
    description: "Split an array into groups of size n. Press Run to try it.",
    code: `function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

const groups = chunk([1, 2, 3, 4, 5, 6, 7], 3);
console.log("groups:", groups);
console.log("count:", groups.length);
groups;`,
  },
  {
    id: "sr-only",
    title: "Visually hidden",
    language: "CSS",
    tags: ["css", "a11y"],
    description: "Hide content visually while keeping it available to screen readers.",
    code: `.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}`,
  },
  {
    id: "top-customers",
    title: "Top customers by revenue",
    language: "SQL",
    tags: ["database", "sql"],
    description: "Aggregate paid orders per customer and rank the top spenders.",
    code: `SELECT c.name, SUM(o.total) AS revenue
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid'
GROUP BY c.name
ORDER BY revenue DESC
LIMIT 10;`,
  },
  {
    id: "read-csv",
    title: "Read CSV rows",
    language: "Python",
    tags: ["python", "data"],
    description: "Load a CSV into a list of dictionaries with the standard library.",
    code: `import csv

def load_rows(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))`,
  },
  {
    id: "git-branches",
    title: "Delete merged branches",
    language: "Bash",
    tags: ["git", "cleanup"],
    description: "Remove local branches already merged into main.",
    code: `git branch --merged main | grep -v "main" | xargs -r git branch -d`,
  },
];

const LANGUAGE_ORDER = ["TypeScript", "JavaScript", "CSS", "Python", "SQL", "Bash"];

const LANGUAGE_BADGE: Record<string, string> = {
  typescript: "bg-blue-500/10 text-blue-400 ring-blue-400/20",
  javascript: "bg-yellow-500/10 text-yellow-400 ring-yellow-400/20",
  css: "bg-sky-500/10 text-sky-400 ring-sky-400/20",
  python: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/20",
  sql: "bg-orange-500/10 text-orange-400 ring-orange-400/20",
  bash: "bg-zinc-500/10 text-zinc-300 ring-zinc-400/20",
};

const EMPTY_DRAFT = { title: "", language: "", tags: "", description: "", code: "" };

type Draft = typeof EMPTY_DRAFT;

type ConsoleState = {
  snippetId: string;
  status: "running" | "success" | "error";
  logs: SandboxLog[];
  result?: string;
  hasResult?: boolean;
  error?: string;
  durationMs?: number;
};

function normalizeLanguage(language: string) {
  return language.trim().toLowerCase();
}

function isRunnable(language: string) {
  return ["ts", "typescript", "tsx", "js", "javascript", "jsx", "mjs", "cjs", "node"].includes(
    normalizeLanguage(language),
  );
}

function isTypeScript(language: string) {
  return ["ts", "typescript", "tsx"].includes(normalizeLanguage(language));
}

function parseTags(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^#+/, "").toLowerCase())
    .filter((tag) => {
      if (!tag || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

function toDraft(snippet: Snippet): Draft {
  return {
    title: snippet.title,
    language: snippet.language,
    tags: (snippet.tags ?? []).map((tag) => `#${tag}`).join(" "),
    description: snippet.description ?? "",
    code: snippet.code,
  };
}

function badgeClass(language: string) {
  return (
    LANGUAGE_BADGE[normalizeLanguage(language)] ??
    "bg-muted text-muted-foreground ring-border"
  );
}

export function SnippetsWidget() {
  const { toast } = useToast();
  const [snippets, setSnippets] = useLocalStorage<Snippet[]>(
    "devdesk:snippets",
    DEFAULT_SNIPPETS,
  );
  const [prefs, setPrefs] = useLocalStorage<{ language: string }>(
    "devdesk:snippet-lang",
    { language: "TypeScript" },
  );

  const [query, setQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);

  const [consoleState, setConsoleState] = useState<ConsoleState | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [running, setRunning] = useState(false);

  useWidgetAction("snippet:new", () => {
    setCreateDraft({ ...EMPTY_DRAFT, language: prefs.language || "TypeScript" });
    setCreating(true);
  });

  const languageOptions = useMemo(() => {
    const set = new Set<string>(LANGUAGE_ORDER);
    snippets.forEach((snippet) => set.add(snippet.language));
    return Array.from(set);
  }, [snippets]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((snippet) => (snippet.tags ?? []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [snippets]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snippets.filter((snippet) => {
      if (languageFilter !== "all" && snippet.language !== languageFilter) return false;
      if (tagFilter && !(snippet.tags ?? []).includes(tagFilter)) return false;
      if (!needle) return true;
      return (
        snippet.title.toLowerCase().includes(needle) ||
        snippet.language.toLowerCase().includes(needle) ||
        snippet.code.toLowerCase().includes(needle) ||
        (snippet.description ?? "").toLowerCase().includes(needle) ||
        (snippet.tags ?? []).some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [snippets, query, languageFilter, tagFilter]);

  const selected = useMemo(() => {
    const byId = selectedId
      ? snippets.find((snippet) => snippet.id === selectedId)
      : undefined;
    return byId ?? filtered[0] ?? null;
  }, [snippets, selectedId, filtered]);

  const activeConsole =
    consoleState && selected && consoleState.snippetId === selected.id ? consoleState : null;

  function copy(snippet: Snippet) {
    void navigator.clipboard
      .writeText(snippet.code)
      .then(() => {
        setCopiedId(snippet.id);
        toast(`Copied "${snippet.title}"`, "success");
        window.setTimeout(
          () => setCopiedId((current) => (current === snippet.id ? null : current)),
          1500,
        );
      })
      .catch(() => toast("Clipboard unavailable", "error"));
  }

  function remove(id: string) {
    setSnippets((current) => current.filter((snippet) => snippet.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editing?.id === id) setEditing(null);
    toast("Snippet deleted", "info");
  }

  function validate(draft: Draft) {
    if (!draft.title.trim() || !draft.code.trim()) {
      toast("Title and code are required", "error");
      return null;
    }
    return {
      title: draft.title.trim(),
      language: draft.language.trim() || "Text",
      code: draft.code,
      tags: parseTags(draft.tags),
      description: draft.description.trim() || undefined,
    };
  }

  function create() {
    const parsed = validate(createDraft);
    if (!parsed) return;
    const id = crypto.randomUUID();
    setSnippets((current) => [{ id, ...parsed }, ...current]);
    setPrefs({ language: parsed.language });
    setSelectedId(id);
    setCreating(false);
    setCreateDraft(EMPTY_DRAFT);
    toast("Snippet created", "success");
  }

  function saveEdit() {
    if (!editing) return;
    const parsed = validate(editing.draft);
    if (!parsed) return;
    setSnippets((current) =>
      current.map((snippet) =>
        snippet.id === editing.id ? { id: editing.id, ...parsed } : snippet,
      ),
    );
    setEditing(null);
    toast("Snippet updated", "success");
  }

  async function run(snippet: Snippet) {
    if (!isRunnable(snippet.language)) {
      toast("Run is only available for JavaScript & TypeScript", "info");
      return;
    }
    setRunning(true);
    setConsoleOpen(true);
    setConsoleState({ snippetId: snippet.id, status: "running", logs: [] });

    try {
      let code = snippet.code;
      if (isTypeScript(snippet.language)) {
        const response = await fetch("/api/transpile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, language: snippet.language }),
        });
        const payload = (await response.json()) as { code?: string; error?: string };
        if (!response.ok || typeof payload.code !== "string") {
          throw new Error(payload.error ?? "Failed to transpile TypeScript.");
        }
        code = payload.code;
      }

      const outcome = await runJavaScript(code, {
        onLog: (log) =>
          setConsoleState((current) =>
            current && current.snippetId === snippet.id
              ? { ...current, logs: [...current.logs, log] }
              : current,
          ),
      });

      setConsoleState({
        snippetId: snippet.id,
        status: outcome.error ? "error" : "success",
        logs: outcome.logs,
        result: outcome.result,
        hasResult: outcome.hasResult,
        error: outcome.error,
        durationMs: outcome.durationMs,
      });
    } catch (error) {
      setConsoleState({
        snippetId: snippet.id,
        status: "error",
        logs: [],
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search snippets…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setCreateDraft({ ...EMPTY_DRAFT, language: prefs.language || "TypeScript" });
            setCreating(true);
          }}
          aria-label="Create snippet"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="scrollbar-thin -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
        <FilterChip
          active={languageFilter === "all"}
          onClick={() => setLanguageFilter("all")}
        >
          All
        </FilterChip>
        {languageOptions.map((language) => (
          <FilterChip
            key={language}
            active={languageFilter === language}
            onClick={() => setLanguageFilter(language)}
          >
            {language}
          </FilterChip>
        ))}
      </div>

      {tagOptions.length > 0 && (
        <div className="scrollbar-thin -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          <Hash className="size-3 shrink-0 text-muted-foreground" />
          {tagOptions.map((tag) => (
            <FilterChip
              key={tag}
              active={tagFilter === tag}
              onClick={() => setTagFilter((current) => (current === tag ? null : tag))}
            >
              #{tag}
            </FilterChip>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="scrollbar-thin -mr-1 flex max-h-40 shrink-0 flex-col gap-1.5 overflow-y-auto pr-1 lg:max-h-[420px] lg:w-44">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No snippets match your filters.
            </p>
          )}
          {filtered.map((snippet) => {
            const active = selected?.id === snippet.id;
            return (
              <button
                key={snippet.id}
                type="button"
                onClick={() => setSelectedId(snippet.id)}
                className={clsx(
                  "flex flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  active
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-muted/20 hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium text-foreground">
                    {snippet.title}
                  </span>
                  <span
                    className={clsx(
                      "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                      badgeClass(snippet.language),
                    )}
                  >
                    {snippet.language}
                  </span>
                </span>
                {(snippet.tags ?? []).length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {(snippet.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-background/60 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-1">
          {editing && selected && editing.id === selected.id ? (
            <SnippetForm
              draft={editing.draft}
              onChange={(draft) => setEditing({ id: editing.id, draft })}
              onSubmit={saveEdit}
              onCancel={() => setEditing(null)}
              submitLabel="Save changes"
              languageOptions={languageOptions}
              autoFocus
            />
          ) : selected ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {selected.title}
                </h3>
                <span
                  className={clsx(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                    badgeClass(selected.language),
                  )}
                >
                  {selected.language}
                </span>
              </div>

              {(selected.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(selected.tags ?? []).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTagFilter(tag)}
                      className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              {selected.description && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {selected.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <ActionButton
                  label={copiedId === selected.id ? "Copied" : "Copy"}
                  icon={copiedId === selected.id ? Check : Copy}
                  onClick={() => copy(selected)}
                  iconClass={copiedId === selected.id ? "text-emerald-500" : undefined}
                />
                <ActionButton
                  label="Edit"
                  icon={Pencil}
                  onClick={() => setEditing({ id: selected.id, draft: toDraft(selected) })}
                />
                <button
                  type="button"
                  onClick={() => void run(selected)}
                  disabled={!isRunnable(selected.language) || running}
                  title={
                    isRunnable(selected.language)
                      ? "Run in sandbox"
                      : "Run is available for JavaScript & TypeScript"
                  }
                  className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {running && activeConsole?.status === "running" ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  Run
                </button>
                <button
                  type="button"
                  onClick={() => remove(selected.id)}
                  aria-label={`Delete ${selected.title}`}
                  className="ml-auto flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-rose-500/50 hover:text-rose-500"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <CodeBlock
                code={selected.code}
                language={selected.language}
                className="max-h-72"
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
              <Code2 className="size-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                No snippet selected. Create one to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {consoleOpen && consoleState && (
        <ConsoleDrawer
          state={consoleState}
          onClear={() => setConsoleState(null)}
          onClose={() => setConsoleOpen(false)}
        />
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New snippet">
        <SnippetForm
          draft={createDraft}
          onChange={setCreateDraft}
          onSubmit={create}
          onCancel={() => setCreating(false)}
          submitLabel="Save snippet"
          languageOptions={languageOptions}
          autoFocus
        />
      </Modal>
    </div>
  );
}

type SnippetFormProps = {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  languageOptions: string[];
  autoFocus?: boolean;
};

function SnippetForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  languageOptions,
  autoFocus,
}: SnippetFormProps) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="snippet-title">
          Title
        </label>
        <input
          id="snippet-title"
          value={draft.title}
          onChange={(event) => set({ title: event.target.value })}
          autoFocus={autoFocus}
          placeholder="e.g. useDebounce"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="snippet-language">
            Language
          </label>
          <select
            id="snippet-language"
            value={draft.language}
            onChange={(event) => set({ language: event.target.value })}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
          >
            {languageOptions.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="snippet-tags">
            Tags
          </label>
          <input
            id="snippet-tags"
            value={draft.tags}
            onChange={(event) => set({ tags: event.target.value })}
            placeholder="#hooks #utility"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor="snippet-description"
        >
          Notes
        </label>
        <textarea
          id="snippet-description"
          value={draft.description}
          onChange={(event) => set({ description: event.target.value })}
          rows={2}
          placeholder="What does this snippet do?"
          className="scrollbar-thin resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="snippet-code">
          Code
        </label>
        <textarea
          id="snippet-code"
          value={draft.code}
          onChange={(event) => set({ code: event.target.value })}
          spellCheck={false}
          rows={9}
          placeholder="Paste your snippet…"
          className="scrollbar-thin resize-none rounded-lg border border-input bg-background p-3 font-mono text-xs leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
        />
      </div>

      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button     
      type="button"
      onClick={onClick}
      className={clsx(
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-foreground"
          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  iconClass,
}: {
  label: string;
  icon: typeof Copy;
  onClick: () => void;
  iconClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className={clsx("size-3.5", iconClass)} />
      {label}
    </button>
  );
}

function ConsoleDrawer({
  state,
  onClear,
  onClose,
}: {
  state: ConsoleState;
  onClear: () => void;
  onClose: () => void;
}) {
  const statusTone =
    state.status === "running"
      ? "text-amber-400"
      : state.status === "success"
        ? "text-emerald-400"
        : "text-rose-400";

  const statusLabel =
    state.status === "running"
      ? "Running…"
      : state.status === "success"
        ? `Completed in ${state.durationMs ?? 0}ms`
        : "Error";

  return (
    <div className="animate-slide-up overflow-hidden rounded-lg border border-zinc-800 bg-[#0b0c10]">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <span
          className={clsx(
            "size-2 shrink-0 rounded-full",
            state.status === "running"
              ? "animate-pulse bg-amber-400"
              : state.status === "success"
                ? "bg-emerald-400"
                : "bg-rose-500",
          )}
        />
        <span className="font-mono text-[11px] font-semibold tracking-wide text-zinc-300">
          CONSOLE
        </span>
        <span className={clsx("font-mono text-[10px]", statusTone)}>{statusLabel}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear console"
            className="flex size-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <Eraser className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close console"
            className="flex size-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="scrollbar-thin max-h-48 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
        {state.logs.length === 0 && state.status !== "error" && (
          <p className="text-zinc-600">
            {state.status === "running" ? "Executing…" : "No console output."}
          </p>
        )}

        {state.logs.map((log, index) => (
          <div key={index} className="flex gap-2 whitespace-pre-wrap break-words">
            <span className={LOG_MARK[log.level]}>›</span>
            <span className={LOG_TEXT[log.level]}>{log.text}</span>
          </div>
        ))}

        {state.hasResult && state.result !== undefined && (
          <div className="mt-1 flex gap-2 border-t border-white/5 pt-1.5 whitespace-pre-wrap break-words text-emerald-300">
            <span className="text-emerald-500">⟵</span>
            <span>{state.result}</span>
          </div>
        )}

        {state.status === "error" && state.error && (
          <pre className="whitespace-pre-wrap break-words text-rose-400">{state.error}</pre>
        )}
      </div>
    </div>
  );
}

const LOG_MARK: Record<SandboxLog["level"], string> = {
  log: "text-zinc-600",
  info: "text-sky-500",
  warn: "text-amber-500",
  error: "text-rose-500",
};

const LOG_TEXT: Record<SandboxLog["level"], string> = {
  log: "text-zinc-200",
  info: "text-sky-300",
  warn: "text-amber-300",
  error: "text-rose-400",
};
