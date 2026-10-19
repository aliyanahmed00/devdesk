export const COLLAB_STORAGE_KEY = "devdesk:collab";

export type PresenceStatus = "active" | "meeting" | "focusing";

export type Teammate = {
  id: string;
  name: string;
  initials: string;
  /** Brand color used for avatars, cursors and activity accents. */
  color: string;
  status: PresenceStatus;
  /** Short status line shown in the roster. */
  note: string;
};

export const PRESENCE_STATUS_META: Record<
  PresenceStatus,
  { label: string; ring: string; dot: string; text: string }
> = {
  active: {
    label: "Active",
    ring: "ring-emerald-400/70",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
  },
  meeting: {
    label: "In Meeting",
    ring: "ring-amber-400/70",
    dot: "bg-amber-400",
    text: "text-amber-300",
  },
  focusing: {
    label: "Focusing",
    ring: "ring-violet-400/70",
    dot: "bg-violet-400",
    text: "text-violet-300",
  },
};

export const TEAM: Teammate[] = [
  {
    id: "gojo",
    name: "Gojo",
    initials: "GO",
    color: "#38bdf8",
    status: "active",
    note: "Reviewing pull requests",
  },
  {
    id: "megumi",
    name: "Megumi",
    initials: "ME",
    color: "#a78bfa",
    status: "meeting",
    note: "Design sync · back at 3:00",
  },
  {
    id: "yuji",
    name: "Yuji",
    initials: "YU",
    color: "#fb7185",
    status: "focusing",
    note: "Focus session · deep work",
  },
  {
    id: "nobara",
    name: "Nobara",
    initials: "NO",
    color: "#34d399",
    status: "active",
    note: "Editing the task board",
  },
];

export function getTeammate(id: string): Teammate | undefined {
  return TEAM.find((member) => member.id === id);
}

export type ActivityKind =
  | "task"
  | "focus"
  | "integration"
  | "snippet"
  | "note"
  | "comment"
  | "deploy";

export type CollabActivity = {
  id: string;
  teammateId: string;
  kind: ActivityKind;
  /** Message text without the teammate name (that is rendered separately). */
  message: string;
  at: number;
};

const ACTIVITY_SCRIPT: { teammateId: string; kind: ActivityKind; message: string }[] =
  [
    { teammateId: "megumi", kind: "task", message: "updated task: Scaffold Next.js app" },
    { teammateId: "yuji", kind: "focus", message: "completed a 25m focus session" },
    { teammateId: "gojo", kind: "integration", message: "connected GitHub" },
    { teammateId: "nobara", kind: "comment", message: "commented on Design tokens" },
    { teammateId: "megumi", kind: "snippet", message: "created snippet: formatDate()" },
    { teammateId: "yuji", kind: "task", message: "moved “Wire up mock API” to In Progress" },
    { teammateId: "gojo", kind: "deploy", message: "shipped preview to Vercel" },
    { teammateId: "nobara", kind: "note", message: "updated the Notes widget" },
    { teammateId: "megumi", kind: "focus", message: "started a focus session" },
    { teammateId: "yuji", kind: "integration", message: "synced Linear issues" },
    { teammateId: "gojo", kind: "snippet", message: "shared snippet: useDebounce()" },
    { teammateId: "nobara", kind: "task", message: "completed: Ship command palette" },
  ];

export function getActivityScriptLength() {
  return ACTIVITY_SCRIPT.length;
}

export function buildActivity(index: number, at = Date.now()): CollabActivity {
  const entry = ACTIVITY_SCRIPT[index % ACTIVITY_SCRIPT.length];
  return {
    id: `live-${index}-${at}`,
    teammateId: entry.teammateId,
    kind: entry.kind,
    message: entry.message,
    at,
  };
}

/** A deterministic-ish opening feed so the panel is never empty. */
export function createSeedActivities(now = Date.now()): CollabActivity[] {
  const seeds: { index: number; offsetMs: number }[] = [
    { index: 0, offsetMs: 42_000 },
    { index: 1, offsetMs: 3 * 60_000 },
    { index: 3, offsetMs: 7 * 60_000 },
    { index: 6, offsetMs: 12 * 60_000 },
    { index: 4, offsetMs: 21 * 60_000 },
  ];
  return seeds.map((seed, order) => {
    const activity = buildActivity(seed.index, now - seed.offsetMs);
    return { ...activity, id: `seed-${order}` };
  });
}

export type CollabSettings = {
  /** Render the animated multiplayer cursor overlay. */
  cursorsEnabled: boolean;
};

export const DEFAULT_COLLAB_SETTINGS: CollabSettings = {
  cursorsEnabled: true,
};

export function normalizeCollabSettings(
  value: Partial<CollabSettings> | null | undefined,
): CollabSettings {
  return {
    cursorsEnabled:
      typeof value?.cursorsEnabled === "boolean"
        ? value.cursorsEnabled
        : DEFAULT_COLLAB_SETTINGS.cursorsEnabled,
  };
}
