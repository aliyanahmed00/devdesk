"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  Check,
  ChevronRight,
  Copy,
  Hash,
  ListChecks,
  Plus,
  Search,
  SquareTerminal,
  Trash2,
  X,
} from "lucide-react";

import { useToast } from "@/components/providers/toast-provider";
import {
  THEME_META,
  THEME_ORDER,
  useTheme,
  type Theme,
} from "@/components/providers/theme-provider";
import {
  DEFAULT_NOTES_STATE,
  NOTES_STORAGE_KEY,
  appendToActiveNote,
  normalizeNotesState,
} from "@/lib/notes";
import {
  createTask,
  INITIAL_BOARD,
  normalizeBoard,
  type Board,
} from "@/components/widgets/task-board-widget";
import { useLocalStorage } from "@/lib/use-local-storage";

export type PinnedCommand = {
  id: string;
  label: string;
  command: string;
  category: string;
};

type Tab = "quick" | "cli";

type LineKind = "input" | "output" | "system" | "warn" | "error";

type Line = {
  id: string;
  kind: LineKind;
  text: string;
};

export type Macro = {
  id: string;
  name: string;
  command: string;
};

export const DEFAULT_COMMANDS: PinnedCommand[] = [
  {
    id: "git-status",
    label: "Show working tree status",
    command: "git status -sb",
    category: "Git",
  },
  {
    id: "git-undo",
    label: "Undo last commit, keep changes",
    command: "git reset --soft HEAD~1",
    category: "Git",
  },
  {
    id: "git-branches",
    label: "Delete local merged branches",
    command:
      'git branch --merged | grep -v "\\*\\|main\\|master" | xargs -n 1 git branch -d',
    category: "Git",
  },
  {
    id: "docker-up",
    label: "Start compose stack",
    command: "docker compose up -d",
    category: "Docker",
  },
  {
    id: "docker-prune",
    label: "Prune unused Docker data",
    command: "docker system prune -af --volumes",
    category: "Docker",
  },
  {
    id: "npm-dev",
    label: "Start dev server",
    command: "npm run dev",
    category: "npm",
  },
  {
    id: "npm-ci",
    label: "Clean install",
    command: "rm -rf node_modules && npm ci",
    category: "npm",
  },
  {
    id: "prisma-studio",
    label: "Open Prisma Studio",
    command: "npx prisma studio",
    category: "Prisma",
  },
  {
    id: "alias-gs",
    label: "Alias for git status",
    command: "alias gs='git status -sb'",
    category: "Shell",
  },
];

export const DEFAULT_MACROS: Macro[] = [
  { id: "macro-dev", name: "dev:start", command: "npm run dev" },
  { id: "macro-git", name: "git status", command: "git status" },
  { id: "macro-docker", name: "docker ps", command: "docker ps" },
  { id: "macro-build", name: "build", command: "npm run build" },
];

const EMPTY_DRAFT = { label: "", command: "", category: "" };

const EMPTY_MACRO = { name: "", command: "" };

const PROMPT = "devdesk@workspace:~$";

const THEME_ALIASES: Record<string, Theme> = {
  obsidian: "dark",
  dark: "dark",
  nord: "nord",
  frost: "nord",
  dracula: "dracula",
  oled: "oled",
  cyberpunk: "oled",
  light: "light",
  daylight: "light",
};

const COMMAND_KEYWORDS = [
  "help",
  "clear",
  "cls",
  "date",
  "time",
  "ping",
  "theme",
  "task",
  "note",
  "alias",
  "macros",
  "history",
  "echo",
  "whoami",
  "pwd",
];

const HELP: { cmd: string; desc: string }[] = [
  { cmd: "help", desc: "List available commands" },
  { cmd: "clear, cls", desc: "Clear the screen output" },
  { cmd: "date", desc: "Show today's date (local + UTC)" },
  { cmd: "time", desc: "Show the current time (local + UTC)" },
  { cmd: "ping <host>", desc: "Measure latency to a host" },
  { cmd: "theme [name]", desc: "Switch theme, or toggle with no name" },
  { cmd: "task add <title>", desc: "Add a card to the task board" },
  { cmd: "note <text>", desc: "Append text to your notes" },
  { cmd: "alias <name>=<cmd>", desc: "Register a macro alias" },
  { cmd: "macros", desc: "List saved macros" },
  { cmd: "history", desc: "Show command history" },
  { cmd: "echo <text>", desc: "Print text to the terminal" },
  { cmd: "whoami", desc: "Print the current user" },
  { cmd: "pwd", desc: "Print the working directory" },
];

const SEED: Line[] = [
  {
    id: "seed",
    kind: "system",
    text: "DevDesk interactive shell v2 — type 'help' for commands, Tab to autocomplete.",
  },
];

type SimResult = { lines: string[]; kind?: LineKind };

function pingOutput(host: string): string {
  const out = [`PING ${host} (127.0.0.1): 56 data bytes`];
  let total = 0;
  for (let i = 0; i < 4; i += 1) {
    const ms = Math.round((Math.random() * 22 + 9) * 10) / 10;
    total += ms;
    out.push(`64 bytes from 127.0.0.1: icmp_seq=${i} ttl=64 time=${ms} ms`);
  }
  out.push(
    "",
    `--- ${host} ping statistics ---`,
    "4 packets transmitted, 4 received, 0% packet loss",
    `round-trip avg = ${(total / 4).toFixed(1)} ms`,
  );
  return out.join("\n");
}

function simulate(raw: string): SimResult | null {
  const tokens = raw.trim().split(/\s+/);
  const bin = (tokens[0] ?? "").toLowerCase();
  const sub = (tokens[1] ?? "").toLowerCase();
  const sub2 = (tokens[2] ?? "").toLowerCase();

  if (bin === "ls" || bin === "ll" || bin === "dir") {
    return {
      lines: [
        "drwxr-xr-x  src/",
        "drwxr-xr-x  public/",
        "drwxr-xr-x  node_modules/",
        "-rw-r--r--  package.json",
        "-rw-r--r--  pnpm-lock.yaml",
        "-rw-r--r--  tsconfig.json",
        "-rw-r--r--  README.md",
      ],
    };
  }

  if (bin === "git") {
    if (sub === "status") {
      return {
        lines: [
          "On branch main",
          "Your branch is up to date with 'origin/main'.",
          "",
          "Changes not staged for commit:",
          "        modified:   src/components/widgets/terminal-widget.tsx",
          "        modified:   src/lib/search-index.ts",
          "",
          "Untracked files:",
          "        src/lib/macros.ts",
          "",
          "no changes added to commit",
        ],
      };
    }
    if (sub === "log") {
      return {
        lines: [
          "commit 9f2a1c3 (HEAD -> main, origin/main)",
          "Author: DevDesk <dev@devdesk.app>",
          "Date:   Wed Oct 14 2026",
          "",
          "    polish: terminal CLI, history & macros",
          "",
          "commit 1b7e4d0",
          "    feat: workspace manager + config export",
        ],
      };
    }
    if (sub === "branch") {
      return {
        lines: ["* main", "  feature/terminal-cli", "  chore/lint-cleanup"],
      };
    }
    if (sub === "pull" || sub === "fetch") {
      return { lines: ["Already up to date."] };
    }
    if (sub === "push") {
      return { lines: ["Everything up-to-date"] };
    }
    if (sub === "diff") {
      return {
        lines: [
          "diff --git a/src/components/widgets/terminal-widget.tsx b/...",
          "@@ -1,3 +1,4 @@",
          '-const PROMPT = "devdesk@workspace ~ %"',
          '+const PROMPT = "devdesk@workspace:~$"',
        ],
      };
    }
    return {
      kind: "warn",
      lines: [`git: '${tokens[1] ?? ""}' is not supported in this shell.`],
    };
  }

  if (bin === "docker" || bin === "docker-compose") {
    if (sub === "ps") {
      return {
        lines: [
          "CONTAINER ID   IMAGE           STATUS         PORTS                    NAMES",
          "3f8c1a9d2b04   postgres:16     Up 2 hours     0.0.0.0:5432->5432/tcp   devdesk-db",
          "a1b2c3d4e5f6   redis:7-alpine  Up 2 hours     0.0.0.0:6379->6379/tcp   devdesk-cache",
        ],
      };
    }
    if (sub === "compose" && sub2 === "up") {
      return {
        lines: [
          "[+] Running 2/2",
          " ✔ Container devdesk-db     Started",
          " ✔ Container devdesk-cache  Started",
        ],
      };
    }
    if (sub === "compose" && sub2 === "down") {
      return {
        lines: [
          "[+] Running 2/2",
          " ✔ Container devdesk-cache  Removed",
          " ✔ Container devdesk-db     Removed",
        ],
      };
    }
    if (sub === "system" && sub2 === "prune") {
      return {
        lines: [
          "Deleted Containers:",
          "  7ab1f0c9d2e3",
          "Total reclaimed space: 1.24GB",
        ],
      };
    }
    if (sub === "images") {
      return {
        lines: [
          "REPOSITORY   TAG        SIZE",
          "postgres     16         432MB",
          "redis        7-alpine   41MB",
        ],
      };
    }
    return {
      kind: "warn",
      lines: [`docker: '${tokens[1] ?? ""}' is not supported in this shell.`],
    };
  }

  if (["npm", "pnpm", "yarn", "bun"].includes(bin)) {
    const task = sub === "run" ? sub2 : sub;
    if (task === "dev" || task === "start") {
      return {
        lines: [
          `> devdesk@0.1.0 ${task}`,
          "> next dev --turbopack",
          "",
          "  ▲ Next.js 16.4.0 (Turbopack)",
          "  - Local:        http://localhost:3000",
          "  - Network:      http://192.168.1.42:3000",
          "",
          " ✓ Ready in 1.2s",
        ],
      };
    }
    if (task === "build") {
      return {
        lines: [
          "> devdesk@0.1.0 build",
          "> next build",
          "",
          "  ▲ Next.js 16.4.0 (Turbopack)",
          "   Creating an optimized production build ...",
          " ✓ Compiled successfully",
          " ✓ Generating static pages (4/4)",
          " ✓ Finalizing page optimization",
        ],
      };
    }
    if (sub === "install" || sub === "i" || sub === "ci" || sub === "add") {
      return {
        lines: [
          `> ${bin} ${sub}`,
          "",
          "added 412 packages, and audited 413 packages in 6s",
          "",
          "found 0 vulnerabilities",
        ],
      };
    }
    if (sub === "test" || task === "test" || sub === "lint") {
      return { lines: [`> ${bin} ${sub}`, "", " ✓ 0 problems (simulated)"] };
    }
    return null;
  }

  if (bin === "npx" || bin === "pnpx" || bin === "bunx") {
    if (sub === "prisma" && sub2 === "studio") {
      return {
        lines: [
          "Prisma schema loaded from prisma/schema.prisma",
          "Prisma Studio is up on http://localhost:5555",
        ],
      };
    }
    if (sub === "prisma") {
      return {
        lines: [
          `Prisma CLI (simulated): ${tokens.slice(2).join(" ") || "no arguments"}`,
        ],
      };
    }
    return { kind: "warn", lines: [`npx: fetched '${tokens[1] ?? ""}' (simulated)`] };
  }

  if (bin === "vercel") {
    return {
      lines: [
        "Vercel CLI 39.0.0",
        "🔍  Inspect: https://vercel.com/devdesk/devdesk (simulated)",
      ],
    };
  }

  if (bin === "cat") {
    if (sub === "package.json") {
      return {
        lines: [
          "{",
          '  "name": "devdesk",',
          '  "version": "0.1.0",',
          '  "packageManager": "pnpm@11.21.0"',
          "}",
        ],
      };
    }
    return {
      kind: "error",
      lines: [`cat: ${tokens[1] ?? ""}: No such file or directory`],
    };
  }

  return null;
}

export function TerminalWidget() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [commands, setCommands] = useLocalStorage<PinnedCommand[]>(
    "devdesk:terminal",
    DEFAULT_COMMANDS,
  );
  const [lines, setLines] = useLocalStorage<Line[]>(
    "devdesk:terminal-output",
    SEED,
  );
  const [history, setHistory] = useLocalStorage<string[]>(
    "devdesk:terminal-history",
    [],
  );
  const [macros, setMacros] = useLocalStorage<Macro[]>(
    "devdesk:terminal-macros",
    DEFAULT_MACROS,
  );
  const [macrosOpen, setMacrosOpen] = useLocalStorage<boolean>(
    "devdesk:terminal-macros-open",
    true,
  );
  const [, setTasks] = useLocalStorage<Board>("devdesk:tasks", INITIAL_BOARD);
  const [, setNotes] = useLocalStorage<unknown>(
    NOTES_STORAGE_KEY,
    DEFAULT_NOTES_STATE,
  );

  const [tab, setTab] = useState<Tab>("quick");

  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [addingMacro, setAddingMacro] = useState(false);
  const [macroDraft, setMacroDraft] = useState(EMPTY_MACRO);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((item) =>
      `${item.label} ${item.command} ${item.category}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, tab]);

  useEffect(() => {
    if (tab === "cli") inputRef.current?.focus();
  }, [tab]);

  async function copy(item: PinnedCommand) {
    try {
      await navigator.clipboard.writeText(item.command);
      setCopiedId(item.id);
      toast(`Copied “${item.label}”`, "success");
      window.setTimeout(
        () => setCopiedId((current) => (current === item.id ? null : current)),
        1500,
      );
    } catch {
      toast("Clipboard unavailable", "error");
    }
  }

  function remove(id: string) {
    setCommands((current) => current.filter((item) => item.id !== id));
    toast("Command removed", "info");
  }

  function create() {
    const label = draft.label.trim();
    const command = draft.command.trim();
    if (!label || !command) {
      toast("Label and command are required", "error");
      return;
    }
    setCommands((current) => [
      {
        id: crypto.randomUUID(),
        label,
        command,
        category: draft.category.trim() || "Shell",
      },
      ...current,
    ]);
    setDraft(EMPTY_DRAFT);
    setAdding(false);
    toast("Command pinned", "success");
  }

  function push(line: Omit<Line, "id">) {
    setLines((prev) => [...prev, { ...line, id: crypto.randomUUID() }]);
  }

  function complete(current: string) {
    const leading = current.match(/^\s*/)?.[0] ?? "";
    const body = current.slice(leading.length);
    const tokens = body.length ? body.split(/\s+/) : [""];
    const partial = tokens[tokens.length - 1] ?? "";
    const first = (tokens[0] ?? "").toLowerCase();

    let pool: string[] = [];
    if (tokens.length <= 1) {
      pool = [...COMMAND_KEYWORDS, ...macros.map((macro) => macro.name)];
    } else if (first === "theme") {
      pool = Object.keys(THEME_ALIASES);
    } else if (first === "task") {
      pool = ["add"];
    } else if (first === "git") {
      pool = ["status", "log", "branch", "pull", "push", "diff"];
    } else if (first === "docker" || first === "docker-compose") {
      pool = ["ps", "images", "compose"];
    } else if (["npm", "pnpm", "yarn", "bun"].includes(first)) {
      pool = ["run", "install", "ci", "test", "lint"];
    }

    const q = partial.toLowerCase();
    const matches = Array.from(
      new Set(pool.filter((candidate) => candidate.toLowerCase().startsWith(q))),
    );
    if (matches.length === 0) return { text: current, matches };

    if (matches.length === 1) {
      tokens[tokens.length - 1] = matches[0];
      return { text: `${leading}${tokens.join(" ")} `, matches };
    }

    let prefix = matches[0];
    for (const match of matches) {
      while (prefix && !match.toLowerCase().startsWith(prefix.toLowerCase())) {
        prefix = prefix.slice(0, -1);
      }
    }
    tokens[tokens.length - 1] = prefix;
    return { text: `${leading}${tokens.join(" ")}`, matches };
  }

  function run(raw: string) {
    setInput("");
    setHistoryIndex(-1);

    const trimmed = raw.trim();
    push({ kind: "input", text: `${PROMPT} ${raw}` });
    if (!trimmed) return;

    setHistory((prev) =>
      prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed],
    );

    const macro = macros.find(
      (item) => item.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const effective = macro ? macro.command : trimmed;
    if (macro && macro.command !== macro.name) {
      push({ kind: "system", text: `↳ ${macro.name} → ${macro.command}` });
    }

    const tokens = effective.split(/\s+/);
    const name = (tokens[0] ?? "").toLowerCase();
    const rest = tokens.slice(1).join(" ");

    switch (name) {
      case "help":
        push({
          kind: "output",
          text: HELP.map((item) => `  ${item.cmd.padEnd(22)} ${item.desc}`).join(
            "\n",
          ),
        });
        return;
      case "clear":
      case "cls":
        setLines([]);
        return;
      case "time": {
        const now = new Date();
        push({
          kind: "output",
          text: `local  ${now.toLocaleTimeString()}\nutc    ${now
            .toISOString()
            .slice(11, 19)}`,
        });
        return;
      }
      case "date": {
        const now = new Date();
        push({
          kind: "output",
          text: `local  ${now.toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}\nutc    ${now.toISOString().slice(0, 10)}`,
        });
        return;
      }
      case "ping": {
        const host = rest.trim() || "devdesk.local";
        push({ kind: "output", text: pingOutput(host) });
        return;
      }
      case "theme": {
        const key = rest.trim().toLowerCase();
        if (!key) {
          const index = THEME_ORDER.indexOf(theme);
          const next = THEME_ORDER[(index + 1) % THEME_ORDER.length];
          setTheme(next);
          push({ kind: "warn", text: `theme toggled → ${THEME_META[next].label}` });
          return;
        }
        const target = THEME_ALIASES[key];
        if (!target) {
          push({
            kind: "warn",
            text: `unknown theme '${rest}' — try: ${Object.keys(THEME_ALIASES).join(
              ", ",
            )}`,
          });
          return;
        }
        setTheme(target);
        push({
          kind: "output",
          text: `Theme → ${THEME_META[target].label} (${target})`,
        });
        return;
      }
      case "task": {
        const action = (tokens[1] ?? "").toLowerCase();
        const title = tokens.slice(2).join(" ").trim();
        if (action !== "add" || !title) {
          push({ kind: "warn", text: "usage: task add <title>" });
          return;
        }
        setTasks((current) => {
          const board = normalizeBoard(current);
          return {
            ...board,
            todo: [...board.todo, createTask(title)],
          };
        });
        push({ kind: "output", text: `✓ Added to To Do: ${title}` });
        toast(`Task added: ${title}`, "success");
        return;
      }
      case "note": {
        const text = rest.trim();
        if (!text) {
          push({ kind: "warn", text: "usage: note <text>" });
          return;
        }
        setNotes((current: unknown) =>
          appendToActiveNote(normalizeNotesState(current), text),
        );
        push({
          kind: "output",
          text: `✓ Appended ${text.length} chars to notes`,
        });
        toast("Note appended", "success");
        return;
      }
      case "alias": {
        if (!rest) {
          if (macros.length === 0) {
            push({ kind: "system", text: "no macros defined" });
            return;
          }
          push({
            kind: "output",
            text: macros.map((item) => `  ${item.name} = ${item.command}`).join("\n"),
          });
          return;
        }
        const eq = rest.indexOf("=");
        if (eq === -1) {
          const found = macros.find(
            (item) => item.name.toLowerCase() === rest.trim().toLowerCase(),
          );
          push({
            kind: "output",
            text: found
              ? `alias ${found.name}='${found.command}'`
              : `alias: ${rest.trim()}: not found`,
          });
          return;
        }
        const aliasName = rest.slice(0, eq).trim();
        const aliasCommand = rest
          .slice(eq + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        if (!aliasName || !aliasCommand) {
          push({ kind: "warn", text: "usage: alias <name>=<command>" });
          return;
        }
        setMacros((current) => {
          const exists = current.some(
            (item) => item.name.toLowerCase() === aliasName.toLowerCase(),
          );
          if (exists) {
            return current.map((item) =>
              item.name.toLowerCase() === aliasName.toLowerCase()
                ? { ...item, command: aliasCommand }
                : item,
            );
          }
          return [
            ...current,
            { id: crypto.randomUUID(), name: aliasName, command: aliasCommand },
          ];
        });
        push({ kind: "output", text: `alias ${aliasName}='${aliasCommand}'` });
        toast(`Alias saved: ${aliasName}`, "success");
        return;
      }
      case "macros": {
        if (macros.length === 0) {
          push({
            kind: "system",
            text: "no macros defined — add one with `alias name=command`",
          });
          return;
        }
        push({
          kind: "output",
          text: macros
            .map((item) => `  ${item.name.padEnd(14)} → ${item.command}`)
            .join("\n"),
        });
        return;
      }
      case "history": {
        if (history.length === 0) {
          push({ kind: "system", text: "no history yet" });
          return;
        }
        push({
          kind: "output",
          text: history
            .map((item, index) => `  ${String(index + 1).padStart(3)}  ${item}`)
            .join("\n"),
        });
        return;
      }
      case "echo":
        push({ kind: "output", text: rest });
        return;
      case "whoami":
        push({ kind: "output", text: "devdesk" });
        return;
      case "pwd":
        push({ kind: "output", text: "/home/devdesk/workspace" });
        return;
      default: {
        const result = simulate(effective);
        if (result) {
          push({ kind: result.kind ?? "output", text: result.lines.join("\n") });
        } else {
          push({ kind: "error", text: `command not found: ${name} — type 'help'` });
        }
      }
    }
  }

  function runMacro(macro: Macro) {
    setTab("cli");
    run(macro.name);
  }

  function saveMacro() {
    const name = macroDraft.name.trim();
    const command = macroDraft.command.trim();
    if (!name || !command) {
      toast("Name and command are required", "error");
      return;
    }
    setMacros((current) => {
      const exists = current.some(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      );
      if (exists) {
        return current.map((item) =>
          item.name.toLowerCase() === name.toLowerCase()
            ? { ...item, command }
            : item,
        );
      }
      return [...current, { id: crypto.randomUUID(), name, command }];
    });
    setMacroDraft(EMPTY_MACRO);
    setAddingMacro(false);
    toast(`Macro saved: ${name}`, "success");
  }

  function removeMacro(id: string) {
    setMacros((current) => current.filter((item) => item.id !== id));
    toast("Macro removed", "info");
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const next =
        historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next]);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex < 0) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    } else if (event.key === "Tab") {
      event.preventDefault();
      const { text, matches } = complete(input);
      if (matches.length === 0) return;
      setInput(text);
      if (matches.length > 1) {
        push({ kind: "system", text: `↹ ${matches.join("   ")}` });
      }
    } else if (
      (event.ctrlKey && (event.key === "l" || event.key === "L")) ||
      (event.metaKey && event.key === "k")
    ) {
      event.preventDefault();
      setLines([]);
    } else if (event.ctrlKey && (event.key === "c" || event.key === "C") && input) {
      event.preventDefault();
      push({ kind: "input", text: `${PROMPT} ${input}^C` });
      setInput("");
      setHistoryIndex(-1);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-500/25 bg-zinc-950 font-mono text-xs shadow-inner">
      <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-black/40 px-3 py-2">
        <span className="size-2.5 rounded-full bg-rose-500/80" />
        <span className="size-2.5 rounded-full bg-amber-400/80" />
        <span className="size-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-2 truncate text-[11px] text-emerald-500/70">
          {tab === "quick"
            ? `~/devdesk — ${commands.length} pinned`
            : "~/devdesk — interactive"}
        </span>
        {tab === "cli" && (
          <button
            type="button"
            onClick={() => setLines([])}
            className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-500/60 transition-colors hover:text-emerald-300"
          >
            <Trash2 className="size-3" />
            clear
          </button>
        )}
        <span
          className={clsx(
            "animate-blink text-emerald-400",
            tab === "quick" && "ml-auto",
          )}
        >
          ▍
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Terminal views"
        className="relative grid grid-cols-2 border-b border-emerald-500/15 bg-black/20 p-1"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-1 rounded-md bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/30 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            width: "calc((100% - 0.5rem) / 2)",
            transform: `translateX(${tab === "quick" ? 0 : 100}%)`,
          }}
        />
        {(
          [
            { id: "quick", label: "Quick Commands", Icon: ListChecks },
            { id: "cli", label: "Interactive CLI", Icon: SquareTerminal },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={clsx(
                "relative z-10 flex min-h-8 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                active
                  ? "text-emerald-300"
                  : "text-emerald-500/60 hover:text-emerald-300",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "quick" ? (
        <div className="animate-fade-in flex flex-col gap-3 p-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-emerald-500/25 bg-black/40 px-2.5 py-1.5">
              <span className="text-emerald-400">$</span>
              <Search className="size-3.5 text-emerald-500/60" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="grep commands…"
                spellCheck={false}
                className="w-full bg-transparent text-xs text-emerald-200 outline-none placeholder:text-emerald-500/40"
              />
            </div>
            <button
              type="button"
              onClick={() => setAdding((value) => !value)}
              aria-label="Pin a command"
              className={clsx(
                "flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                adding
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                  : "border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10",
              )}
            >
              <Plus className="size-4" />
            </button>
          </div>

          {adding && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                create();
              }}
              className="animate-slide-down flex flex-col gap-2 rounded-md border border-emerald-500/25 bg-black/30 p-2.5"
            >
              <input
                value={draft.label}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                autoFocus
                placeholder="label (e.g. Deploy staging)"
                className="rounded-md border border-emerald-500/20 bg-black/40 px-2.5 py-1.5 text-xs text-emerald-100 outline-none placeholder:text-emerald-500/40 focus:border-emerald-400/50"
              />
              <input
                value={draft.command}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    command: event.target.value,
                  }))
                }
                placeholder="command to run"
                spellCheck={false}
                className="rounded-md border border-emerald-500/20 bg-black/40 px-2.5 py-1.5 text-xs text-emerald-100 outline-none placeholder:text-emerald-500/40 focus:border-emerald-400/50"
              />
              <div className="flex items-center gap-2">
                <input
                  value={draft.category}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  placeholder="category"
                  className="w-28 rounded-md border border-emerald-500/20 bg-black/40 px-2.5 py-1.5 text-xs text-emerald-100 outline-none placeholder:text-emerald-500/40 focus:border-emerald-400/50"
                />
                <button
                  type="submit"
                  className="ml-auto rounded-md bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-emerald-950 transition-opacity hover:opacity-90"
                >
                  Pin command
                </button>
              </div>
            </form>
          )}

          <div className="scrollbar-thin -mr-1 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <p className="py-8 text-center text-xs text-emerald-500/60">
                {commands.length === 0
                  ? "No commands pinned yet."
                  : `No matches for “${query}”.`}
              </p>
            )}

            {filtered.map((item) => {
              const copied = copiedId === item.id;
              return (
                <div
                  key={item.id}
                  className="group rounded-md border border-emerald-500/15 bg-black/30 p-2.5 transition-colors hover:border-emerald-400/40"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-400">
                      {item.category}
                    </span>
                    <span className="truncate text-xs text-emerald-100">
                      {item.label}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void copy(item)}
                        aria-label={`Copy ${item.label}`}
                        className="flex size-6 items-center justify-center rounded border border-emerald-500/25 text-emerald-400 transition-colors hover:bg-emerald-500/10"
                      >
                        {copied ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        aria-label={`Delete ${item.label}`}
                        className="flex size-6 items-center justify-center rounded border border-emerald-500/25 text-emerald-400/70 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <pre className="scrollbar-thin mt-1.5 overflow-x-auto text-[11px] leading-relaxed text-emerald-300/80">
                    <span className="select-none text-emerald-500/60">$ </span>
                    {item.command}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="animate-fade-in flex flex-col">
          <div
            ref={outputRef}
            className="scrollbar-thin h-64 overflow-y-auto px-3 py-3 leading-relaxed"
          >
            {lines.length === 0 && (
              <div className="text-emerald-500/50">
                Cleared. Type &apos;help&apos; to list commands.
              </div>
            )}
            {lines.map((line) => (
              <div
                key={line.id}
                className={clsx(
                  "whitespace-pre-wrap break-words",
                  line.kind === "input" && "text-emerald-300",
                  line.kind === "output" && "text-emerald-100/80",
                  line.kind === "system" && "text-emerald-500/60",
                  line.kind === "warn" && "text-cyan-300",
                  line.kind === "error" && "text-rose-400",
                )}
              >
                {line.text}
              </div>
            ))}
          </div>

          <div className="border-t border-emerald-500/15 bg-black/30">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <button
                type="button"
                onClick={() => setMacrosOpen((value) => !value)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500/70 transition-colors hover:text-emerald-300"
              >
                <ChevronRight
                  className={clsx(
                    "size-3 transition-transform",
                    macrosOpen && "rotate-90",
                  )}
                />
                <Hash className="size-3" />
                Macros
                <span className="text-emerald-500/40">{macros.length}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMacrosOpen(true);
                  setAddingMacro((value) => !value);
                }}
                aria-label="Add macro"
                className={clsx(
                  "ml-auto flex size-6 items-center justify-center rounded border transition-colors",
                  addingMacro
                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                    : "border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10",
                )}
              >
                <Plus className="size-3.5" />
              </button>
            </div>

            {macrosOpen && (
              <div className="animate-slide-down flex flex-wrap items-center gap-1.5 px-3 pb-2">
                {macros.length === 0 && !addingMacro && (
                  <span className="text-[11px] text-emerald-500/50">
                    No macros — use{" "}
                    <code className="text-emerald-400">alias name=command</code>
                  </span>
                )}
                {macros.map((macro) => (
                  <span
                    key={macro.id}
                    className="flex items-center overflow-hidden rounded-md border border-emerald-500/25 bg-emerald-500/5 text-[11px]"
                  >
                    <button
                      type="button"
                      onClick={() => runMacro(macro)}
                      title={macro.command}
                      className="px-2 py-1 text-emerald-300 transition-colors hover:bg-emerald-500/15"
                    >
                      {macro.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMacro(macro.id)}
                      aria-label={`Remove macro ${macro.name}`}
                      className="flex h-full items-center px-1 text-emerald-500/40 transition-colors hover:text-rose-400"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {addingMacro && macrosOpen && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  saveMacro();
                }}
                className="animate-slide-down flex flex-wrap items-center gap-1.5 border-t border-emerald-500/10 px-3 py-2"
              >
                <input
                  autoFocus
                  value={macroDraft.name}
                  onChange={(event) =>
                    setMacroDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="name (e.g. deploy)"
                  spellCheck={false}
                  className="w-32 rounded border border-emerald-500/20 bg-black/40 px-2 py-1 text-[11px] text-emerald-100 outline-none placeholder:text-emerald-500/40 focus:border-emerald-400/50"
                />
                <span className="text-emerald-500/50">=</span>
                <input
                  value={macroDraft.command}
                  onChange={(event) =>
                    setMacroDraft((current) => ({
                      ...current,
                      command: event.target.value,
                    }))
                  }
                  placeholder="command (e.g. npm run build)"
                  spellCheck={false}
                  className="min-w-40 flex-1 rounded border border-emerald-500/20 bg-black/40 px-2 py-1 text-[11px] text-emerald-100 outline-none placeholder:text-emerald-500/40 focus:border-emerald-400/50"
                />
                <button
                  type="submit"
                  className="rounded bg-emerald-500/90 px-2.5 py-1 text-[11px] font-medium text-emerald-950 transition-opacity hover:opacity-90"
                >
                  Save
                </button>
              </form>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(input);
            }}
            className="flex items-center gap-2 border-t border-emerald-500/15 bg-black/30 px-3 py-2"
          >
            <span className="shrink-0 select-none text-emerald-400">
              {PROMPT}
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              spellCheck={false}
              autoComplete="off"
              aria-label="Terminal input"
              placeholder="type a command… (Tab to complete)"
              className="flex-1 bg-transparent text-emerald-100 caret-emerald-400 outline-none placeholder:text-emerald-500/40"
            />
          </form>
        </div>
      )}
    </div>
  );
}
