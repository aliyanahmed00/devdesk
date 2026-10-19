export type SessionKind = "work" | "short-break" | "long-break";

export type SessionLog = {
  id: string;
  kind: SessionKind;
  endedAt: number;
  durationMs: number;
};

export type PomodoroSettings = {
  work: number;
  break: number;
  longBreak: number;
  longBreakInterval: number;
  goalSessions: number;
  goalMinutes: number;
  sound: boolean;
  tick: boolean;
  notifications: boolean;
};

export const POMODORO_STORAGE_KEY = "devdesk:pomodoro";
export const POMODORO_LOG_KEY = "devdesk:pomodoro-log";
export const MAX_LOG_ENTRIES = 2000;

export const DEFAULT_SETTINGS: PomodoroSettings = {
  work: 25,
  break: 5,
  longBreak: 15,
  longBreakInterval: 4,
  goalSessions: 4,
  goalMinutes: 100,
  sound: true,
  tick: false,
  notifications: false,
};

export const SESSION_KINDS: SessionKind[] = [
  "work",
  "short-break",
  "long-break",
];

export const SESSION_KIND_META: Record<
  SessionKind,
  { label: string; short: string }
> = {
  work: { label: "Focus session", short: "Focus" },
  "short-break": { label: "Short break", short: "Short break" },
  "long-break": { label: "Long break", short: "Long break" },
};

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const numeric =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function clampBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeSettings(raw: unknown): PomodoroSettings {
  const value = (raw ?? {}) as Partial<PomodoroSettings>;
  return {
    work: clampNumber(value.work, DEFAULT_SETTINGS.work, 1, 180),
    break: clampNumber(value.break, DEFAULT_SETTINGS.break, 1, 90),
    longBreak: clampNumber(value.longBreak, DEFAULT_SETTINGS.longBreak, 1, 90),
    longBreakInterval: clampNumber(
      value.longBreakInterval,
      DEFAULT_SETTINGS.longBreakInterval,
      1,
      12,
    ),
    goalSessions: clampNumber(
      value.goalSessions,
      DEFAULT_SETTINGS.goalSessions,
      1,
      24,
    ),
    goalMinutes: clampNumber(
      value.goalMinutes,
      DEFAULT_SETTINGS.goalMinutes,
      5,
      720,
    ),
    sound: clampBool(value.sound, DEFAULT_SETTINGS.sound),
    tick: clampBool(value.tick, DEFAULT_SETTINGS.tick),
    notifications: clampBool(
      value.notifications,
      DEFAULT_SETTINGS.notifications,
    ),
  };
}

export function durationFor(settings: PomodoroSettings, kind: SessionKind) {
  if (kind === "work") return settings.work;
  if (kind === "short-break") return settings.break;
  return settings.longBreak;
}

export function isSessionKind(value: unknown): value is SessionKind {
  return SESSION_KINDS.includes(value as SessionKind);
}

export function createSessionLog(
  kind: SessionKind,
  durationMs: number,
  endedAt: number,
): SessionLog {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `log-${endedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, kind, endedAt, durationMs: Math.max(0, Math.round(durationMs)) };
}

export function normalizeLog(raw: unknown): SessionLog[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is Partial<SessionLog> =>
        !!item && typeof item === "object",
    )
    .map((item) => {
      const kind = isSessionKind(item.kind) ? item.kind : "work";
      const endedAt =
        typeof item.endedAt === "number" && Number.isFinite(item.endedAt)
          ? item.endedAt
          : 0;
      const durationMs =
        typeof item.durationMs === "number" && Number.isFinite(item.durationMs)
          ? Math.max(0, item.durationMs)
          : 0;
      const id =
        typeof item.id === "string" && item.id
          ? item.id
          : `log-${endedAt.toString(36)}-${kind}`;
      return { id, kind, endedAt, durationMs };
    })
    .filter((item) => item.endedAt > 0)
    .sort((a, b) => a.endedAt - b.endedAt)
    .slice(-MAX_LOG_ENTRIES);
}

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export type DaySummary = {
  key: string;
  timestamp: number;
  workSessions: number;
  shortBreaks: number;
  longBreaks: number;
  focusMs: number;
};

export function summarizeByDay(
  logs: SessionLog[],
  days: number,
  now: number,
): DaySummary[] {
  const buckets = new Map<string, DaySummary>();
  const result: DaySummary[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const timestamp = date.getTime();
    const summary: DaySummary = {
      key: dayKey(timestamp),
      timestamp,
      workSessions: 0,
      shortBreaks: 0,
      longBreaks: 0,
      focusMs: 0,
    };
    buckets.set(summary.key, summary);
    result.push(summary);
  }

  for (const log of logs) {
    const bucket = buckets.get(dayKey(log.endedAt));
    if (!bucket) continue;
    if (log.kind === "work") {
      bucket.workSessions += 1;
      bucket.focusMs += log.durationMs;
    } else if (log.kind === "short-break") {
      bucket.shortBreaks += 1;
    } else {
      bucket.longBreaks += 1;
    }
  }

  return result;
}

export function workSessionsSinceLongBreak(logs: SessionLog[]): number {
  let count = 0;
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const kind = logs[index].kind;
    if (kind === "long-break") break;
    if (kind === "work") count += 1;
  }
  return count;
}

export function minutesFromMs(ms: number): number {
  return ms / 60_000;
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 1) return "0m";
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function heatLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayLabel(timestamp: number): string {
  return WEEKDAYS[new Date(timestamp).getDay()];
}
