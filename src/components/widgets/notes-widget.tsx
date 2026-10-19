"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx } from "clsx";
import {
  Bold,
  CheckCircle2,
  Columns2,
  Code,
  Download,
  Eye,
  FileText,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListTodo,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Search,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";

import { useToast } from "@/components/providers/toast-provider";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useLocalStorage } from "@/lib/use-local-storage";
import {
  DEFAULT_NOTES_PREFS,
  DEFAULT_NOTES_STATE,
  NOTES_HISTORY_KEY,
  NOTES_HISTORY_LIMIT,
  NOTES_PREFS_KEY,
  NOTES_STORAGE_KEY,
  createNoteDoc,
  ensureMarkdownName,
  noteDisplayTitle,
  normalizeNotesState,
  normalizePrefs,
  type NoteDoc,
  type NotesHistory,
  type NotesState,
  type NotesViewMode,
} from "@/lib/notes";
import { useWidgetAction } from "@/lib/widget-actions";

const VIEW_TABS: readonly TabItem<NotesViewMode>[] = [
  { id: "split", label: "Split", icon: Columns2 },
  { id: "edit", label: "Edit", icon: Pencil },
  { id: "preview", label: "Preview", icon: Eye },
];

type ToolButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

function ToolButton({ icon: Icon, label, onClick, disabled }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="size-3.5" />
    </button>
  );
}

type NoteSearchHit = {
  id: string;
  title: string;
  snippet: string;
  count: number;
  index: number;
};

function NoteSearchResultRow(props: {
  hit: NoteSearchHit;
  onSelect: (id: string, resultIndex: number) => void;
}) {
  const { hit, onSelect } = props;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(hit.id, hit.index)}
        className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
      >
        <span className="flex w-full items-center justify-between gap-2 text-xs font-medium text-foreground">
          <span className="truncate">{noteDisplayTitle(hit.title)}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
            {hit.count} {hit.count === 1 ? "hit" : "hits"}
          </span>
        </span>
        <span className="line-clamp-1 text-[11px] text-muted-foreground">
          {hit.snippet}
        </span>
      </button>
    </li>
  );
}

export function NotesWidget() {
  const { toast } = useToast();
  const [stored, setStored] = useLocalStorage<NotesState | string>(
    NOTES_STORAGE_KEY,
    DEFAULT_NOTES_STATE,
  );
  const [storedPrefs, setStoredPrefs] = useLocalStorage(
    NOTES_PREFS_KEY,
    DEFAULT_NOTES_PREFS,
  );
  const [history, setHistory] = useLocalStorage<NotesHistory>(
    NOTES_HISTORY_KEY,
    {},
  );

  const state = useMemo(() => normalizeNotesState(stored), [stored]);
  const prefs = useMemo(() => normalizePrefs(storedPrefs), [storedPrefs]);
  const viewMode = prefs.viewMode;
  const editable = viewMode !== "preview";

  const activeDoc =
    state.docs.find((doc) => doc.id === state.activeId) ??
    state.docs[0] ??
    DEFAULT_NOTES_STATE.docs[0];

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renameCancelled = useRef(false);

  const mutate = useCallback(
    (fn: (current: NotesState) => NotesState) => {
      setStored((current) => fn(normalizeNotesState(current)));
    },
    [setStored],
  );

  const updateContent = useCallback(
    (content: string) => {
      mutate((current) => ({
        ...current,
        docs: current.docs.map((doc) =>
          doc.id === current.activeId ? { ...doc, content } : doc,
        ),
      }));
    },
    [mutate],
  );

  const setActiveDoc = useCallback(
    (id: string) => {
      mutate((current) =>
        current.docs.some((doc) => doc.id === id)
          ? { ...current, activeId: id }
          : current,
      );
    },
    [mutate],
  );

  const addDoc = useCallback(
    (title?: string) => {
      const doc = createNoteDoc(title);
      mutate((current) => ({
        docs: [...current.docs, doc],
        activeId: doc.id,
      }));
      return doc.id;
    },
    [mutate],
  );

  const renameDoc = useCallback(
    (id: string, title: string) => {
      const next = ensureMarkdownName(title);
      mutate((current) => ({
        ...current,
        docs: current.docs.map((doc) =>
          doc.id === id ? { ...doc, title: next } : doc,
        ),
      }));
    },
    [mutate],
  );

  const closeDoc = useCallback(
    (id: string) => {
      mutate((current) => {
        if (current.docs.length <= 1) return current;
        const index = current.docs.findIndex((doc) => doc.id === id);
        if (index === -1) return current;
        const docs = current.docs.filter((doc) => doc.id !== id);
        const activeId =
          current.activeId === id
            ? docs[Math.min(index, docs.length - 1)].id
            : current.activeId;
        return { docs, activeId };
      });
      toast("Note closed", "info");
    },
    [mutate, toast],
  );

  const focusEditor = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, []);

  const handleNewDoc = useCallback(() => {
    addDoc();
    if (viewMode === "preview") {
      setStoredPrefs({ viewMode: "split" });
    }
    focusEditor();
  }, [addDoc, focusEditor, setStoredPrefs, viewMode]);

  useWidgetAction("notes:new", handleNewDoc);

  useEffect(() => {
    const doc = state.docs.find((item) => item.id === state.activeId);
    if (!doc) return;
    const timer = window.setTimeout(() => {
      setHistory((current) => {
        const existing = current[doc.id];
        const entries = existing?.entries ?? [];
        const index = existing?.index ?? -1;
        if (index >= 0 && entries[index]?.content === doc.content) {
          return current;
        }
        const kept = entries.slice(0, index + 1);
        kept.push({ content: doc.content, at: Date.now() });
        const trimmed =
          kept.length > NOTES_HISTORY_LIMIT
            ? kept.slice(kept.length - NOTES_HISTORY_LIMIT)
            : kept;
        return { ...current, [doc.id]: { entries: trimmed, index: trimmed.length - 1 } };
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state.activeId, state.docs, setHistory]);

  const insertWrap = useCallback(
    (before: string, after: string, placeholder: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const { selectionStart: start, selectionEnd: end } = el;
      const selected = el.value.slice(start, end) || placeholder;
      const next = `${el.value.slice(0, start)}${before}${selected}${after}${el.value.slice(end)}`;
      updateContent(next);
      window.requestAnimationFrame(() => {
        el.focus();
        const from = start + before.length;
        el.setSelectionRange(from, from + selected.length);
      });
    },
    [updateContent],
  );

  const insertLinePrefix = useCallback(
    (prefix: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const value = el.value;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      let lineEnd = value.indexOf("\n", end);
      if (lineEnd === -1) lineEnd = value.length;
      const block = value.slice(lineStart, lineEnd);
      const nextBlock = block
        .split("\n")
        .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line))
        .join("\n");
      updateContent(value.slice(0, lineStart) + nextBlock + value.slice(lineEnd));
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(lineStart, lineStart + nextBlock.length);
      });
    },
    [updateContent],
  );

  const activeHistory = history[activeDoc.id];

  const undo = useCallback(() => {
    const entry = history[activeDoc.id];
    if (!entry || entry.index <= 0) return;
    const nextIndex = entry.index - 1;
    const snapshot = entry.entries[nextIndex];
    if (!snapshot) return;
    setHistory((current) => ({ ...current, [activeDoc.id]: { ...entry, index: nextIndex } }));
    updateContent(snapshot.content);
  }, [activeDoc.id, history, setHistory, updateContent]);

  const redo = useCallback(() => {
    const entry = history[activeDoc.id];
    if (!entry || entry.index >= entry.entries.length - 1) return;
    const nextIndex = entry.index + 1;
    const snapshot = entry.entries[nextIndex];
    if (!snapshot) return;
    setHistory((current) => ({ ...current, [activeDoc.id]: { ...entry, index: nextIndex } }));
    updateContent(snapshot.content);
  }, [activeDoc.id, history, setHistory, updateContent]);

  const canUndo = Boolean(activeHistory && activeHistory.index > 0);
  const canRedo = Boolean(
    activeHistory && activeHistory.index < activeHistory.entries.length - 1,
  );

  function startRename(doc: NoteDoc) {
    renameCancelled.current = false;
    setRenamingId(doc.id);
    setRenameValue(doc.title);
  }

  function commitRename() {
    if (!renamingId) return;
    if (!renameCancelled.current) renameDoc(renamingId, renameValue);
    renameCancelled.current = false;
    setRenamingId(null);
  }

  function onRenameKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    } else if (event.key === "Escape") {
      event.preventDefault();
      renameCancelled.current = true;
      commitRename();
    }
  }

  function onEditorKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      insertWrap("**", "**", "bold text");
    } else if (key === "i") {
      event.preventDefault();
      insertWrap("*", "*", "italic text");
    }
  }

  function downloadActive() {
    const blob = new Blob([activeDoc.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = ensureMarkdownName(activeDoc.title);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast(`Downloaded ${anchor.download}`, "success");
  }

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: {
      id: string;
      title: string;
      snippet: string;
      count: number;
      index: number;
    }[] = [];
    for (const doc of state.docs) {
      const lower = doc.content.toLowerCase();
      const lowerTitle = doc.title.toLowerCase();
      const inTitle = lowerTitle.includes(q);
      const contentIndex = lower.indexOf(q);
      if (!inTitle && contentIndex === -1) continue;
      const count =
        (lowerTitle.split(q).length - 1) + (lower.split(q).length - 1);
      let snippet = "Title match";
      if (contentIndex >= 0) {
        const from = Math.max(0, contentIndex - 24);
        const to = Math.min(doc.content.length, contentIndex + q.length + 48);
        snippet = `${from > 0 ? "…" : ""}${doc.content
          .slice(from, to)
          .replace(/\s+/g, " ")
          .trim()}${to < doc.content.length ? "…" : ""}`;
      }
      results.push({ id: doc.id, title: doc.title, snippet, count, index: contentIndex });
    }
    return results;
  }, [query, state.docs]);

  const selectResult = useCallback(
    (id: string, resultIndex: number) => {
      if (resultIndex < 0) return;
      const el = textareaRef.current;
      if (!el) return;
      const length = query.trim().length;
      el.focus();
      el.setSelectionRange(resultIndex, resultIndex + length);
    },
    [query],
  );

  const stats = useMemo(() => {
    const trimmed = activeDoc.content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return { words, chars: activeDoc.content.length };
  }, [activeDoc.content]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <div
          role="tablist"
          aria-label="Note documents"
          className="scrollbar-thin flex flex-1 items-center gap-1 overflow-x-auto pb-1"
        >
          {state.docs.map((doc) => {
            const active = doc.id === state.activeId;
            const renaming = renamingId === doc.id;
            return (
              <div
                key={doc.id}
                className={clsx(
                  "group flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {renaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={onRenameKeyDown}
                    className="w-28 bg-transparent font-medium text-foreground outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveDoc(doc.id)}
                    onDoubleClick={() => startRename(doc)}
                    title="Double-click to rename"
                    className="flex items-center gap-1.5"
                  >
                    <FileText className="size-3.5 shrink-0" />
                    <span className="max-w-32 truncate">
                      {noteDisplayTitle(doc.title)}
                    </span>
                  </button>
                )}
                {state.docs.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Close ${doc.title}`}
                    onClick={() => closeDoc(doc.id)}
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={handleNewDoc}
          aria-label="New note"
          title="New note"
          className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((open) => !open);
            if (searchOpen) setQuery("");
          }}
          aria-label="Search notes"
          title="Search notes"
          aria-pressed={searchOpen}
          className={clsx(
            "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
            searchOpen
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Search className="size-3.5" />
        </button>
      </div>

      {searchOpen && (
        <div className="animate-fade-in rounded-lg border border-border bg-background p-2">
          <div className="flex items-center gap-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search across all notes…"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={() => {
                setSearchOpen(false);
                setQuery("");
              }}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {query.trim() && (
            <ul className="scrollbar-thin mt-2 max-h-40 overflow-auto">
              {searchResults.length === 0 ? (
                <li className="px-1 py-2 text-xs text-muted-foreground">
                  No matches found.
                </li>
              ) : (
                searchResults.map((result) => (
                  <NoteSearchResultRow
                    key={`${result.id}-${result.index}`}
                    hit={result}
                    onSelect={selectResult}
                  />
                ))
              )}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
          <ToolButton
            icon={Heading1}
            label="Heading 1"
            disabled={!editable}
            onClick={() => insertLinePrefix("# ")}
          />
          <ToolButton
            icon={Heading2}
            label="Heading 2"
            disabled={!editable}
            onClick={() => insertLinePrefix("## ")}
          />
          <ToolButton
            icon={Bold}
            label="Bold"
            disabled={!editable}
            onClick={() => insertWrap("**", "**", "bold text")}
          />
          <ToolButton
            icon={Italic}
            label="Italic"
            disabled={!editable}
            onClick={() => insertWrap("*", "*", "italic text")}
          />
          <ToolButton
            icon={Code}
            label="Inline code"
            disabled={!editable}
            onClick={() => insertWrap("`", "`", "code")}
          />
          <ToolButton
            icon={Link2}
            label="Link"
            disabled={!editable}
            onClick={() => insertWrap("[", "](https://)", "link text")}
          />
          <ToolButton
            icon={ListTodo}
            label="Task checkbox"
            disabled={!editable}
            onClick={() => insertLinePrefix("- [ ] ")}
          />
          <ToolButton
            icon={List}
            label="Bullet list"
            disabled={!editable}
            onClick={() => insertLinePrefix("- ")}
          />
        </div>

        <div className="flex items-center gap-2">
          <Tabs
            tabs={VIEW_TABS}
            value={viewMode}
            onChange={(mode) => setStoredPrefs({ viewMode: mode })}
            ariaLabel="Editor view mode"
            size="sm"
            className="w-40 shrink-0"
          />
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
            <ToolButton icon={Undo2} label="Undo" onClick={undo} disabled={!canUndo} />
            <ToolButton icon={Redo2} label="Redo" onClick={redo} disabled={!canRedo} />
            <ToolButton
              icon={PenLine}
              label="Rename note"
              onClick={() => startRename(activeDoc)}
            />
            <ToolButton
              icon={Download}
              label="Download .md"
              onClick={downloadActive}
            />
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "grid gap-3",
          viewMode === "split" ? "lg:grid-cols-2" : "grid-cols-1",
        )}
      >
        {editable && (
          <div className="flex min-w-0 flex-col">
            <textarea
              ref={textareaRef}
              value={activeDoc.content}
              onChange={(event) => updateContent(event.target.value)}
              onKeyDown={onEditorKeyDown}
              spellCheck={false}
              placeholder="# Start typing markdown…"
              className="scrollbar-thin h-72 min-h-[18rem] w-full resize-none rounded-lg border border-input bg-background p-3 font-mono text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
            />
          </div>
        )}

        {viewMode !== "edit" && (
          <div className="flex min-w-0 flex-col">
            <div className="prose prose-sm dark:prose-invert scrollbar-thin h-72 min-h-[18rem] max-w-none overflow-auto rounded-lg border border-border bg-background p-3">
              <Markdown remarkPlugins={[remarkGfm]}>
                {activeDoc.content || "*Nothing to preview yet.*"}
              </Markdown>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3" />
          {stats.words} {stats.words === 1 ? "word" : "words"} · {stats.chars}{" "}
          chars · autosaved
        </span>
        <span className="flex items-center gap-1.5">
          {state.docs.length} {state.docs.length === 1 ? "doc" : "docs"} ·{" "}
          <span className="uppercase tracking-wider">{viewMode}</span>
        </span>
      </div>
    </div>
  );
}


