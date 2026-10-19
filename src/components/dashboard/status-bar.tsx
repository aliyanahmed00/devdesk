"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Keyboard,
  Layers,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

import { useLofi } from "@/components/providers/lofi-provider";
import { useMockApi } from "@/components/providers/mock-api-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";

type Tone = "green" | "amber" | "red";

type Health = {
  label: string;
  tone: Tone;
  icon: LucideIcon;
};

function healthStatus(online: boolean, latency: number | null): Health {
  if (!online) return { label: "All Systems Offline", tone: "red", icon: WifiOff };
  if (latency !== null && latency >= 220) {
    return { label: "Degraded Performance", tone: "amber", icon: Wifi };
  }
  return { label: "All Systems Operational", tone: "green", icon: Wifi };
}

const TONE_DOT: Record<Tone, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

const TONE_TEXT: Record<Tone, string> = {
  green: "text-emerald-500",
  amber: "text-amber-500",
  red: "text-rose-500",
};

function tzLabel(now: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || undefined,
      timeZoneName: "short",
    }).formatToParts(now);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

type StatusBarProps = {
  onOpenShortcuts?: () => void;
};

export function StatusBar({ onOpenShortcuts }: StatusBarProps) {
  const { settings, toggleMute } = useLofi();
  const { activeProfile } = useWorkspace();
  const { offline: simulatedOffline } = useMockApi();

  const [online, setOnline] = useState(true);
  const [latency, setLatency] = useState<number | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [timeZone, setTimeZone] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const latencyRef = useRef(52);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) setOnline(navigator.onLine);
    };
    const boot = window.setTimeout(update, 0);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      active = false;
      window.clearTimeout(boot);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const step = () => {
      if (!active) return;
      const target = 22 + Math.random() * 150;
      latencyRef.current = Math.round(
        latencyRef.current + (target - latencyRef.current) * 0.4,
      );
      setLatency(latencyRef.current);
    };
    const boot = window.setTimeout(step, 0);
    const interval = window.setInterval(step, 2200);
    return () => {
      active = false;
      window.clearTimeout(boot);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      setNow(new Date());
      try {
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
      } catch {
        setTimeZone("");
      }
    };
    const boot = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);
    return () => {
      active = false;
      window.clearTimeout(boot);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) setFullscreen(Boolean(document.fullscreenElement));
    };
    const boot = window.setTimeout(update, 0);
    document.addEventListener("fullscreenchange", update);
    return () => {
      active = false;
      window.clearTimeout(boot);
      document.removeEventListener("fullscreenchange", update);
    };
  }, []);

  useEffect(() => {
    if (!onOpenShortcuts) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "?" && event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      onOpenShortcuts();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenShortcuts]);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen();
    }
  };

  const health = healthStatus(online && !simulatedOffline, latency);
  const HealthIcon = health.icon;
  const muted = settings.muted;

  const time = now
    ? now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";
  const zone = now ? tzLabel(now, timeZone) : "";

  return (
    <footer className="sticky bottom-0 z-20 flex items-center justify-between gap-4 border-t border-zinc-800/80 bg-zinc-950/80 px-6 py-2 font-mono text-xs text-zinc-400 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={clsx("flex items-center gap-2 font-medium", TONE_TEXT[health.tone])}
          title={health.label}
        >
          <span className="relative flex size-1.5">
            {health.tone === "green" && (
              <span
                className={clsx(
                  "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                  TONE_DOT[health.tone],
                )}
              />
            )}
            <span
              className={clsx(
                "relative inline-flex size-1.5 rounded-full",
                TONE_DOT[health.tone],
              )}
            />
          </span>
          <HealthIcon className="size-3.5" />
          <span className="hidden truncate sm:inline">{health.label}</span>
        </span>

        <span className="flex items-center gap-1.5 tabular-nums">
          <Activity className="size-3.5 opacity-70" />
          {latency === null ? "--" : latency}
          <span className="text-zinc-600">ms</span>
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <span
          className="hidden items-center gap-1.5 md:flex"
          title={activeProfile?.name ?? "Workspace"}
        >
          <Layers className="size-3.5 opacity-70" />
          <span className="max-w-40 truncate text-zinc-300">
            {activeProfile?.name ?? "Workspace"}
          </span>
        </span>

        <span className="flex items-center gap-1.5 tabular-nums" title={timeZone}>
          <span className="text-zinc-200">{time}</span>
          {zone && <span className="text-zinc-500">{zone}</span>}
        </span>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute audio" : "Mute audio"}
            title={muted ? "Unmute audio" : "Mute audio"}
            className={clsx(
              "flex size-7 items-center justify-center rounded transition-colors hover:bg-zinc-800/60 hover:text-zinc-100",
              muted ? "text-rose-400" : "text-zinc-400",
            )}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="flex size-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            {fullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="flex h-7 items-center gap-1 rounded px-1.5 text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            <Keyboard className="size-3.5" />
            <kbd className="rounded border border-zinc-700 px-1 font-mono text-[10px] leading-4">
              ?
            </kbd>
          </button>
        </div>
      </div>
    </footer>
  );
}
