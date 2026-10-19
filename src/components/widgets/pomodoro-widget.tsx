"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Coffee,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";

import { useToast } from "@/components/providers/toast-provider";
import { useSoundEffects } from "@/components/providers/sound-provider";
import { Modal } from "@/components/ui/modal";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Tabs } from "@/components/ui/tabs";
import {
  DEFAULT_SETTINGS,
  MAX_LOG_ENTRIES,
  POMODORO_LOG_KEY,
  POMODORO_STORAGE_KEY,
  SESSION_KIND_META,
  createSessionLog,
  durationFor,
  formatMinutes,
  heatLevel,
  minutesFromMs,
  normalizeLog,
  normalizeSettings,
  summarizeByDay,
  weekdayLabel,
  workSessionsSinceLongBreak,
  type PomodoroSettings,
  type SessionKind,
  type SessionLog,
} from "@/lib/pomodoro";
import { formatRelativeTime, useNow } from "@/lib/relative-time";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useWidgetAction } from "@/lib/widget-actions";

const MODES: { id: SessionKind; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "short-break", label: "Short" },
  { id: "long-break", label: "Long" },
];

const MODE_STYLE: Record<
  SessionKind,
  { ring: string; bar: string; pulse: string; icon: typeof Zap }
> = {
  work: {
    ring: "text-indigo-500",
    bar: "bg-indigo-500",
    pulse: "bg-amber-500",
    icon: Zap,
  },
  "short-break": {
    ring: "text-emerald-500",
    bar: "bg-emerald-500",
    pulse: "bg-emerald-500",
    icon: Coffee,
  },
  "long-break": {
    ring: "text-sky-500",
    bar: "bg-sky-500",
    pulse: "bg-sky-500",
    icon: Moon,
  },
};

const HEAT_BG = [
  "bg-muted",
  "bg-indigo-500/25",
  "bg-indigo-500/45",
  "bg-indigo-500/70",
  "bg-indigo-500",
];

function format(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function StatRing({
  value,
  max,
  label,
  color,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <ProgressRing value={value} max={max} size={52} stroke={5} className={color}>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </ProgressRing>
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground/60">
        / {max}
      </span>
    </div>
  );
}

export function PomodoroWidget() {
  const { toast } = useToast();
  const { play } = useSoundEffects();

  const [settingsRaw, setSettings] = useLocalStorage<PomodoroSettings>(
    POMODORO_STORAGE_KEY,
    DEFAULT_SETTINGS,
  );
  const [logsRaw, setLogs] = useLocalStorage<SessionLog[]>(
    POMODORO_LOG_KEY,
    [],
  );

  const settings = useMemo(() => normalizeSettings(settingsRaw), [settingsRaw]);
  const logs = useMemo(() => normalizeLog(logsRaw), [logsRaw]);

  const [mode, setMode] = useState<SessionKind>("work");
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(settings.work * 60_000);
  const [showSettings, setShowSettings] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  const deadlineRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lastSecondRef = useRef<number | null>(null);
  const logsRef = useRef<SessionLog[]>(logs);

  const now = useNow(30_000);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    if (!showSettings) return;
    const id = window.setTimeout(() => {
      setPermission(
        typeof Notification !== "undefined"
          ? Notification.permission
          : "unsupported",
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, [showSettings]);

  const { work, break: breakMinutes, longBreak, longBreakInterval, sound, tick, notifications } =
    settings;

  const durationMs = durationFor(settings, mode) * 60_000;

  useWidgetAction("pomodoro:toggle", toggle);
  useWidgetAction("pomodoro:reset", reset);
  useWidgetAction("pomodoro:start", startWorkSession);

  function playBeeps(count: number, frequency: number, volume: number) {
    if (!sound) return;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const ctx = audioRef.current ?? new Ctor();
      audioRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      for (let i = 0; i < count; i += 1) {
        const start = now + i * 0.3;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      }
    } catch {
      // Web Audio unavailable; ignore.
    }
  }

  function notify(title: string, body: string) {
    if (!notifications) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, { body, silent: true });
    } catch {
      // Notification constructor unavailable; ignore.
    }
  }

  function handleComplete(finished: SessionKind, plannedMs: number) {
    const entry = createSessionLog(finished, plannedMs, Date.now());
    const nextLogs = [...logsRef.current, entry].slice(-MAX_LOG_ENTRIES);
    logsRef.current = nextLogs;
    setLogs(nextLogs);

    if (sound) play("chime");

    if (finished === "work") {
      const count = workSessionsSinceLongBreak(nextLogs);
      const useLong = count > 0 && count % longBreakInterval === 0;
      const nextKind: SessionKind = useLong ? "long-break" : "short-break";
      switchTo(nextKind);
      const body = useLong
        ? "Nice streak. Take a long break to recharge."
        : "Time for a short break.";
      notify("Focus session complete", body);
      toast(
        `Focus session complete — ${useLong ? "long" : "short"} break time`,
        "success",
      );
    } else {
      switchTo("work");
      notify("Break over", "Back to focus.");
      toast("Break over — back to focus", "info");
    }
  }

  useEffect(() => {
    if (!running) return;
    lastSecondRef.current = null;
    const id = window.setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline == null) return;
      const left = deadline - Date.now();

      if (left <= 0) {
        deadlineRef.current = null;
        setRunning(false);
        const plannedMs =
          (mode === "work"
            ? work
            : mode === "short-break"
              ? breakMinutes
              : longBreak) * 60_000;
        handleComplete(mode, plannedMs);
        return;
      }

      if (tick) {
        const second = Math.ceil(left / 1000);
        if (second !== lastSecondRef.current) {
          lastSecondRef.current = second;
          playBeeps(1, 520, 0.05);
        }
      }

      setRemainingMs(left);
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    running,
    mode,
    work,
    breakMinutes,
    longBreak,
    longBreakInterval,
    tick,
    sound,
    notifications,
  ]);

  function start() {
    const base = remainingMs > 0 ? remainingMs : durationMs;
    deadlineRef.current = Date.now() + base;
    setRunning(true);
  }

  function pause() {
    if (deadlineRef.current != null) {
      setRemainingMs(Math.max(0, deadlineRef.current - Date.now()));
    }
    deadlineRef.current = null;
    setRunning(false);
  }

  function toggle() {
    if (running) pause();
    else start();
  }

  function startWorkSession() {
    const ms = settings.work * 60_000;
    setMode("work");
    setRemainingMs(ms);
    deadlineRef.current = Date.now() + ms;
    setRunning(true);
  }

  function reset() {
    deadlineRef.current = null;
    setRunning(false);
    setRemainingMs(durationMs);
  }

  function switchTo(next: SessionKind) {
    deadlineRef.current = null;
    setRunning(false);
    setMode(next);
    setRemainingMs(durationFor(settings, next) * 60_000);
  }

  function updateSettings(patch: Partial<PomodoroSettings>) {
    const next = normalizeSettings({ ...settings, ...patch });
    setSettings(next);
    const activeDurationChanged =
      (mode === "work" && next.work !== settings.work) ||
      (mode === "short-break" && next.break !== settings.break) ||
      (mode === "long-break" && next.longBreak !== settings.longBreak);
    if (activeDurationChanged) {
      deadlineRef.current = null;
      setRunning(false);
      setRemainingMs(durationFor(next, mode) * 60_000);
    }
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      toast("Desktop notifications aren't supported here", "error");
      return;
    }
    if (Notification.permission === "granted") {
      updateSettings({ notifications: true });
      return;
    }
    const result = await Notification.requestPermission();
    updateSettings({ notifications: result === "granted" });
    if (result !== "granted") {
      toast("Notifications were blocked by the browser", "error");
    }
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const elapsedMs = Math.max(0, durationMs - remainingMs);
  const style = MODE_STYLE[mode];
  const ModeIcon = style.icon;

  const week = useMemo(() => summarizeByDay(logs, 7, now), [logs, now]);
  const today = week[week.length - 1];
  const minutesToday = minutesFromMs(today?.focusMs ?? 0);
  const goalRatio =
    settings.goalMinutes > 0
      ? Math.min(100, (minutesToday / settings.goalMinutes) * 100)
      : 0;
  const longBreakGoal = Math.max(
    1,
    Math.floor(settings.goalSessions / Math.max(1, settings.longBreakInterval)),
  );
  const weekScale = Math.max(
    settings.goalMinutes,
    ...week.map((day) => minutesFromMs(day.focusMs)),
    1,
  );
  const recent = [...logs].reverse().slice(0, 3);

  return (
    <div
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === " " && event.target === event.currentTarget) {
          event.preventDefault();
          toggle();
        }
      }}
      className="flex h-full flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="flex items-center gap-2">
        <Tabs
          tabs={MODES}
          value={mode}
          onChange={switchTo}
          ariaLabel="Timer mode"
          size="sm"
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          aria-label="Timer settings"
          className="flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-9"
        >
          <Settings className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <ProgressRing
          value={elapsedMs}
          max={durationMs}
          size={168}
          stroke={8}
          className={style.ring}
        >
          <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {format(totalSeconds)}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            <ModeIcon className="size-3" />
            {SESSION_KIND_META[mode].short}
          </span>
        </ProgressRing>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:h-10"
          >
            {running ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {running ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Reset timer"
            className="flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-10"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {running && (
            <span className="relative flex size-1.5" aria-hidden>
              <span
                className={clsx(
                  "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                  style.pulse,
                )}
              />
              <span
                className={clsx(
                  "relative inline-flex size-1.5 rounded-full",
                  style.pulse,
                )}
              />
            </span>
          )}
          {sound ? (
            <Volume2 className="size-3" />
          ) : (
            <VolumeX className="size-3" />
          )}
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium">
            Space
          </kbd>
          to play / pause
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            <Activity className="size-3.5" />
            Today
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {formatMinutes(minutesToday)} focused
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <StatRing
            value={today?.workSessions ?? 0}
            max={settings.goalSessions}
            label="Focus"
            color="text-indigo-500"
          />
          <StatRing
            value={today?.shortBreaks ?? 0}
            max={settings.goalSessions}
            label="Short"
            color="text-emerald-500"
          />
          <StatRing
            value={today?.longBreaks ?? 0}
            max={longBreakGoal}
            label="Long"
            color="text-sky-500"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Focus goal</span>
            <span className="tabular-nums">
              {Math.round(minutesToday)} / {settings.goalMinutes} min
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-700 ease-out"
              style={{ width: `${goalRatio}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Last 7 days
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {formatMinutes(
                week.reduce((sum, day) => sum + minutesFromMs(day.focusMs), 0),
              )}
            </span>
          </div>
          <div className="flex items-end justify-between gap-1.5">
            {week.map((day, index) => {
              const minutes = minutesFromMs(day.focusMs);
              const level = heatLevel(minutes, weekScale);
              const height = Math.max(5, Math.min(100, (minutes / weekScale) * 100));
              const isToday = index === week.length - 1;
              return (
                <div
                  key={day.key}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${weekdayLabel(day.timestamp)} · ${Math.round(
                    minutes,
                  )} min · ${day.workSessions} session${
                    day.workSessions === 1 ? "" : "s"
                  }`}
                >
                  <div className="flex h-14 w-full items-end">
                    <div
                      className={clsx(
                        "w-full rounded-[4px] transition-[height] duration-500 ease-out",
                        HEAT_BG[level],
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span
                    className={clsx(
                      "text-[10px]",
                      isToday
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {weekdayLabel(day.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Recent
            </span>
            <ul className="space-y-0.5">
              {recent.map((session) => {
                const meta = SESSION_KIND_META[session.kind];
                return (
                  <li
                    key={session.id}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="flex items-center gap-1.5 text-foreground">
                      <span
                        className={clsx(
                          "size-1.5 rounded-full",
                          MODE_STYLE[session.kind].bar,
                        )}
                      />
                      {meta.short}
                      <span className="text-muted-foreground">
                        {formatMinutes(minutesFromMs(session.durationMs))}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {formatRelativeTime(session.endedAt, now || session.endedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Timer settings"
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Work
              <input
                type="number"
                min={1}
                max={180}
                value={work}
                onChange={(event) =>
                  updateSettings({ work: Number(event.target.value) || 1 })
                }
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Short break
              <input
                type="number"
                min={1}
                max={90}
                value={breakMinutes}
                onChange={(event) =>
                  updateSettings({ break: Number(event.target.value) || 1 })
                }
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Long break
              <input
                type="number"
                min={1}
                max={90}
                value={longBreak}
                onChange={(event) =>
                  updateSettings({ longBreak: Number(event.target.value) || 1 })
                }
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Long every
              <input
                type="number"
                min={1}
                max={12}
                value={longBreakInterval}
                onChange={(event) =>
                  updateSettings({
                    longBreakInterval: Number(event.target.value) || 1,
                  })
                }
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Goal sessions
              <input
                type="number"
                min={1}
                max={24}
                value={settings.goalSessions}
                onChange={(event) =>
                  updateSettings({
                    goalSessions: Number(event.target.value) || 1,
                  })
                }
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Goal minutes
              <input
                type="number"
                min={5}
                max={720}
                step={5}
                value={settings.goalMinutes}
                onChange={(event) =>
                  updateSettings({
                    goalMinutes: Number(event.target.value) || 5,
                  })
                }
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/25"
              />
            </label>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <Bell className="size-4 text-muted-foreground" />
              Alarm sound
            </span>
            <input
              type="checkbox"
              checked={sound}
              onChange={(event) => updateSettings({ sound: event.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </label>

          <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <Volume2 className="size-4 text-muted-foreground" />
              Tick each second
            </span>
            <input
              type="checkbox"
              checked={tick}
              onChange={(event) => updateSettings({ tick: event.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </label>

          <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-foreground">
                <Bell className="size-4 text-muted-foreground" />
                Desktop notifications
              </span>
              <span className="pl-6 text-[11px] text-muted-foreground">
                {permission === "unsupported"
                  ? "Not supported in this browser"
                  : permission === "granted"
                    ? "Enabled"
                    : permission === "denied"
                      ? "Blocked in browser settings"
                      : "Permission will be requested"}
              </span>
            </span>
            <input
              type="checkbox"
              checked={notifications}
              disabled={permission === "unsupported"}
              onChange={(event) => {
                if (event.target.checked) void enableNotifications();
                else updateSettings({ notifications: false });
              }}
              className="size-5 accent-[var(--primary)]"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </Modal>
    </div>
  );
}
