"use client";

import {
  notifyStorage,
  removeStorageRaw,
  writeStorageRaw,
} from "@/lib/use-local-storage";

export const WORKSPACES_STORAGE_KEY = "devdesk:workspaces";
export const WORKSPACE_PREFIX = "devdesk:";

/** Keys that describe workspaces themselves and must never be captured. */
export const WORKSPACE_EXCLUDED_KEYS = [WORKSPACES_STORAGE_KEY];

export const WORKSPACE_FALLBACK_WIDGETS = [
  "notes",
  "pomodoro",
  "task-board",
  "snippets",
];

export type WorkspaceData = Record<string, unknown>;

export type WorkspaceProfile = {
  id: string;
  name: string;
  glyph: string;
  createdAt: number;
  updatedAt: number;
  data: WorkspaceData;
};

export type WorkspaceStore = {
  profiles: WorkspaceProfile[];
  activeId: string;
};

export const EMPTY_WORKSPACE_STORE: WorkspaceStore = {
  profiles: [],
  activeId: "",
};

export type WorkspacePreset = {
  id: string;
  name: string;
  glyph: string;
  description: string;
  widgets: string[];
};

export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  {
    id: "personal",
    name: "Personal",
    glyph: "🏠",
    description: "Balanced notes, timer, tasks and snippets.",
    widgets: ["notes", "pomodoro", "task-board", "snippets"],
  },
  {
    id: "work",
    name: "Work",
    glyph: "💼",
    description: "Kanban, notes, snippets, shell and repo activity.",
    widgets: ["task-board", "notes", "snippets", "terminal", "github"],
  },
  {
    id: "focus",
    name: "Focus",
    glyph: "🎯",
    description: "Deep-work timer, ambient audio and notes.",
    widgets: ["pomodoro", "lofi", "notes"],
  },
  {
    id: "frontend",
    name: "Frontend Dev",
    glyph: "🧩",
    description: "Sandbox, shell, GitHub and live telemetry.",
    widgets: [
      "snippets",
      "terminal",
      "github",
      "resource-monitor",
      "notes",
    ],
  },
];

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isWorkspaceKey(key: string): boolean {
  return (
    key.startsWith(WORKSPACE_PREFIX) && !WORKSPACE_EXCLUDED_KEYS.includes(key)
  );
}

/** Read every persisted DevDesk key into a plain snapshot object. */
export function snapshotLiveData(): WorkspaceData {
  const data: WorkspaceData = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !isWorkspaceKey(key)) continue;
    const raw = window.localStorage.getItem(key);
    data[key] = raw === null ? null : safeParse(raw);
  }
  return data;
}

/**
 * Replace the live DevDesk state with the given snapshot, notifying every
 * `useLocalStorage` subscriber so the UI updates without a page reload.
 */
export function applyLiveData(data: WorkspaceData) {
  const present: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && isWorkspaceKey(key)) present.push(key);
  }

  const targetKeys = Object.keys(data).filter(isWorkspaceKey);

  for (const key of present) {
    if (!targetKeys.includes(key)) removeStorageRaw(key);
  }

  for (const key of targetKeys) {
    const value = data[key];
    if (value === null || value === undefined) {
      removeStorageRaw(key);
    } else {
      writeStorageRaw(key, JSON.stringify(value));
    }
  }
}

export function enabledWidgetIds(data: WorkspaceData): string[] {
  const raw = data["devdesk:widgets"];
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string");
  }
  return [...WORKSPACE_FALLBACK_WIDGETS];
}

export function estimateBytes(data: WorkspaceData): number {
  const json = JSON.stringify(data);
  try {
    return new Blob([json]).size;
  } catch {
    return json.length;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}

export type WorkspaceExport = {
  app: "DevDesk";
  kind: "workspace";
  version: number;
  name: string;
  exportedAt: string;
  data: WorkspaceData;
};

export function buildExport(
  profile: Pick<WorkspaceProfile, "name">,
  data: WorkspaceData,
): WorkspaceExport {
  return {
    app: "DevDesk",
    kind: "workspace",
    version: 1,
    name: profile.name,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export type ParsedImport = { name: string; data: WorkspaceData };

/** Validate an imported workspace file and normalise it into a snapshot. */
export function parseImport(text: string): ParsedImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Unexpected file contents.");
  }

  const record = parsed as Record<string, unknown>;
  let data: unknown = record.data;
  let name = typeof record.name === "string" ? record.name : undefined;

  if (data === undefined) {
    const looksLikeMap = Object.keys(record).some((key) =>
      key.startsWith(WORKSPACE_PREFIX),
    );
    if (!looksLikeMap) {
      throw new Error("No workspace data found in that file.");
    }
    data = record;
    name = name ?? "Imported workspace";
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("No workspace data found in that file.");
  }

  const workspaceData: WorkspaceData = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (key.startsWith(WORKSPACE_PREFIX)) workspaceData[key] = value;
  }

  if (Object.keys(workspaceData).length === 0) {
    throw new Error("No DevDesk settings found in that file.");
  }

  return {
    name: name?.trim() || "Imported workspace",
    data: workspaceData,
  };
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { notifyStorage };
