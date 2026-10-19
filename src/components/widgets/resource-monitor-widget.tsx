"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Cpu,
  Gauge,
  Pause,
  Play,
  MemoryStick,
  Wifi,
  WifiOff,
  SignalMedium,
  Activity,
  ChartLine,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

import { useLocalStorage } from "@/lib/use-local-storage";

type Tone = "green" | "amber" | "red";

type Sample = {
  t: number;
  cpu: number;
  memActive: number;
  memCached: number;
  memTotal: number;
  memLive: boolean;
  latency: number;
  fps: number;
  frameTime: number;
};

type Prefs = {
  speedMs: number;
  gauge: "ring" | "bar";
};

type SamplerState = {
  cpu: number;
  cpuTarget: number;
  memActive: number;
  memActiveTarget: number;
  memCached: number;
  memCachedTarget: number;
  latency: number;
  latencyTarget: number;
  tick: number;
};

const STORAGE_KEY = "devdesk:resource-monitor";
const DEFAULT_PREFS: Prefs = { speedMs: 1500, gauge: "ring" };

const MEMORY_TOTAL_GB = 16;
const HISTORY_MS = 30_000;
const FALLBACK_FPS = 60;
const SEED_POINTS = 20;

const SPEEDS = [
  { label: "1s", ms: 1000 },
  { label: "1.5s", ms: 1500 },
  { label: "3s", ms: 3000 },
  { label: "5s", ms: 5000 },
] as const;

const TONE_TEXT: Record<Tone, string> = {
  green: "text-emerald-400",
  amber: "text-amber-400",
  red: "text-rose-400",
};

const TONE_STROKE: Record<Tone, string> = {
  green: "#34d399",
  amber: "#fbbf24",
  red: "#fb7185",
};

const TONE_CHIP: Record<Tone, string> = {
  green: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/25",
  amber: "bg-amber-500/10 text-amber-400 ring-amber-400/25",
  red: "bg-rose-500/10 text-rose-400 ring-rose-400/25",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function walk(current: number, target: number, volatility: number, ease: number) {
  return current + (target - current) * ease + (Math.random() - 0.5) * volatility;
}

function loadTone(percent: number): Tone {
  if (percent < 60) return "green";
  if (percent <= 85) return "amber";
  return "red";
}

function fpsTone(fps: number): Tone {
  if (fps >= 55) return "green";
  if (fps >= 30) return "amber";
  return "red";
}

function latencyStatus(ms: number): { label: string; tone: Tone; icon: LucideIcon } {
  if (ms < 90) return { label: "Active", tone: "green", icon: Wifi };
  if (ms < 200) return { label: "Degraded", tone: "amber", icon: SignalMedium };
  return { label: "Offline", tone: "red", icon: WifiOff };
}

type HeapMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

function readHeap() {
  if (typeof performance === "undefined") return null;
  const memory = (performance as Performance & { memory?: HeapMemory }).memory;
  if (!memory || !memory.jsHeapSizeLimit) return null;
  return {
    used: memory.usedJSHeapSize / 1_000_000_000,
    limit: memory.jsHeapSizeLimit / 1_000_000_000,
  };
}

function createSampler(): SamplerState {
  return {
    cpu: 26,
    cpuTarget: 30,
    memActive: 6.4,
    memActiveTarget: 6.5,
    memCached: 3.1,
    memCachedTarget: 3.2,
    latency: 44,
    latencyTarget: 48,
    tick: 0,
  };
}

function step(state: SamplerState, now: number, fps: number): Sample {
  state.tick += 1;

  if (state.tick % 5 === 0) {
    state.cpuTarget = clamp(16 + Math.random() * 68, 4, 99);
    state.latencyTarget = clamp(28 + Math.random() * 120, 12, 320);
    state.memActiveTarget = clamp(state.memActive + (Math.random() - 0.45) * 2.4, 2.5, 13);
    state.memCachedTarget = clamp(state.memCached + (Math.random() - 0.5) * 1.4, 1, 6.5);
  }

  if (fps > 0 && fps < 55) {
    state.cpuTarget = clamp(state.cpuTarget + (55 - fps) * 0.4, 4, 99);
  }

  state.cpu = clamp(walk(state.cpu, state.cpuTarget, 5, 0.25), 0, 100);
  state.memActive = clamp(walk(state.memActive, state.memActiveTarget, 0.22, 0.15), 0.5, 14);
  state.memCached = clamp(walk(state.memCached, state.memCachedTarget, 0.16, 0.12), 0.4, 7);
  state.latency = clamp(walk(state.latency, state.latencyTarget, 16, 0.25), 8, 400);

  const heap = readHeap();
  let memActive = state.memActive;
  let memLive = false;
  if (heap) {
    const pressure = clamp(heap.used / heap.limit, 0, 1);
    const target = clamp(1.5 + pressure * 11, 1, 14);
    memActive = clamp(state.memActive * 0.6 + target * 0.4, 0.8, 14);
    memLive = true;
  }

  const fpsValue = fps > 0 ? clamp(fps, 1, 240) : FALLBACK_FPS;

  return {
    t: now,
    cpu: state.cpu,
    memActive,
    memCached: state.memCached,
    memTotal: MEMORY_TOTAL_GB,
    memLive,
    latency: Math.round(state.latency),
    fps: fpsValue,
    frameTime: 1000 / fpsValue,
  };
}

type SparklineProps = {
  data: number[];
  tone: Tone;
  min?: number;
  max?: number;
  className?: string;
};

function Sparkline({ data, tone, min, max, className }: SparklineProps) {
  const gradientId = useId();
  const width = 100;
  const height = 30;
  const pad = 3;
  const stroke = TONE_STROKE[tone];

  const lo = min ?? (data.length ? Math.min(...data) : 0);
  const hi = max ?? (data.length ? Math.max(...data) : 1);
  const span = hi - lo || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;

  const coords = data.map((value, index) => {
    const x = index * stepX;
    const y = height - pad - ((value - lo) / span) * (height - pad * 2);
    return [x, clamp(y, pad, height - pad)] as const;
  });

  const line = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = coords.length
    ? `${line} L${width},${height} L0,${height} Z`
    : "";
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={clsx("h-9 w-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {coords.length < 2 ? (
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      ) : (
        <>
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ transition: "stroke 0.5s ease" }}
          />
          {last && (
            <circle
              cx={last[0]}
              cy={last[1]}
              r="1.6"
              fill={stroke}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </>
      )}
    </svg>
  );
}

function RadialGauge({ value, tone }: { value: number; tone: Tone }) {
  const size = 120;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamp(value, 0, 100) / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            transition:
              "stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1), stroke 0.5s ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {Math.round(value)}
          <span className="text-sm font-normal text-muted-foreground">%</span>
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          CPU
        </span>
      </div>
    </div>
  );
}

function BarGauge({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {Math.round(value)}
        </span>
        <span className="text-sm text-muted-foreground">%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={clsx(
            "h-full rounded-full",
            tone === "green"
              ? "bg-emerald-500"
              : tone === "amber"
                ? "bg-amber-500"
                : "bg-rose-500",
          )}
          style={{
            width: `${clamp(value, 0, 100)}%`,
            transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
    </div>
  );
}

function MetricShell({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {aside && <span className="ml-auto">{aside}</span>}
      </div>
      {children}
    </div>
  );
}

export function ResourceMonitorWidget() {
  const [prefs, setPrefs] = useLocalStorage<Prefs>(STORAGE_KEY, DEFAULT_PREFS);
  const [paused, setPaused] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);

  const samplerRef = useRef<SamplerState | null>(null);
  const fpsRef = useRef(FALLBACK_FPS);
  const speedMs = prefs.speedMs;
  const gauge = prefs.gauge;

  useEffect(() => {
    const sampler = samplerRef.current ?? createSampler();
    samplerRef.current = sampler;
    const now = Date.now();
    const seeded: Sample[] = [];
    for (let i = SEED_POINTS - 1; i >= 0; i -= 1) {
      seeded.push(step(sampler, now - i * DEFAULT_PREFS.speedMs, FALLBACK_FPS));
    }
    const id = window.setTimeout(() => setSamples(seeded), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      const sampler = samplerRef.current;
      if (!sampler) return;
      const now = Date.now();
      const sample = step(sampler, now, fpsRef.current);
      setSamples((previous) => {
        const cutoff = now - HISTORY_MS;
        return [...previous, sample].filter((point) => point.t >= cutoff);
      });
    }, speedMs);
    return () => window.clearInterval(id);
  }, [paused, speedMs]);

  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (timestamp: number) => {
      frames += 1;
      if (timestamp - last >= 500) {
        fpsRef.current = (frames * 1000) / (timestamp - last);
        frames = 0;
        last = timestamp;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  const setSpeed = useCallback(
    (ms: number) => setPrefs((current) => ({ ...current, speedMs: ms })),
    [setPrefs],
  );
  const toggleGauge = useCallback(
    () =>
      setPrefs((current) => ({
        ...current,
        gauge: current.gauge === "ring" ? "bar" : "ring",
      })),
    [setPrefs],
  );

  const current = samples.length ? samples[samples.length - 1] : null;
  const cpu = current?.cpu ?? 0;
  const memUsed = current ? current.memActive + current.memCached : 0;
  const memPercent = current ? (memUsed / current.memTotal) * 100 : 0;
  const latency = current?.latency ?? 0;
  const fps = current?.fps ?? FALLBACK_FPS;
  const frameTime = current?.frameTime ?? 1000 / FALLBACK_FPS;

  const cpuTone = loadTone(cpu);
  const memTone = loadTone(memPercent);
  const status = latencyStatus(latency);
  const fpsRating = fpsTone(fps);
  const StatusIcon = status.icon;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex size-2" aria-hidden>
          {!paused && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          )}
          <span
            className={clsx(
              "relative inline-flex size-2 rounded-full",
              paused ? "bg-zinc-500" : "bg-emerald-500",
            )}
          />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {paused ? "Paused" : "Live"}
        </span>
        <span className="text-[10px] text-muted-foreground">· last 30s</span>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-border bg-background/50 p-0.5">
            {SPEEDS.map((option) => (
              <button
                key={option.ms}
                type="button"
                onClick={() => setSpeed(option.ms)}
                className={clsx(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors",
                  speedMs === option.ms
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleGauge}
            title={`Gauge: ${gauge === "ring" ? "Ring" : "Bar"} (click to switch)`}
            aria-label="Toggle gauge style"
            className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {gauge === "ring" ? (
              <Gauge className="size-3.5" />
            ) : (
              <ChartLine className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? "Resume updates" : "Pause updates"}
            className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricShell
          icon={Cpu}
          title="Processor"
          aside={
            <span className={clsx("text-sm font-semibold tabular-nums", TONE_TEXT[cpuTone])}>
              {Math.round(cpu)}%
            </span>
          }
        >
          <div className="flex flex-col items-center gap-2">
            {gauge === "ring" ? (
              <RadialGauge value={cpu} tone={cpuTone} />
            ) : (
              <BarGauge value={cpu} tone={cpuTone} />
            )}
            <Sparkline
              data={samples.map((point) => point.cpu)}
              tone={cpuTone}
              min={0}
              max={100}
            />
          </div>
        </MetricShell>

        <MetricShell
          icon={MemoryStick}
          title="Memory"
          aside={
            <span className={clsx("text-sm font-semibold tabular-nums", TONE_TEXT[memTone])}>
              {memPercent.toFixed(0)}%
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold tabular-nums">
                {memUsed.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                / {MEMORY_TOTAL_GB} GB
              </span>
              {current?.memLive && (
                <Zap
                  className="ml-auto size-3 text-emerald-400"
                  aria-label="Informed by performance.memory"
                />
              )}
            </div>

            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-indigo-500"
                style={{
                  width: `${((current?.memActive ?? 0) / MEMORY_TOTAL_GB) * 100}%`,
                  transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)",
                }}
              />
              <div
                className="h-full bg-sky-500/60"
                style={{
                  width: `${((current?.memCached ?? 0) / MEMORY_TOTAL_GB) * 100}%`,
                  transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </div>

            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-indigo-500" />
                Active {(current?.memActive ?? 0).toFixed(1)} GB
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-sky-500/60" />
                Cached {(current?.memCached ?? 0).toFixed(1)} GB
              </span>
            </div>

            <Sparkline
              data={samples.map((point) =>
                ((point.memActive + point.memCached) / point.memTotal) * 100,
              )}
              tone={memTone}
              min={0}
              max={100}
            />
          </div>
        </MetricShell>

        <MetricShell
          icon={Activity}
          title="Network"
          aside={
            <span
              className={clsx(
                "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                TONE_CHIP[status.tone],
              )}
            >
              <StatusIcon className="size-3" />
              {status.label}
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-1">
              <span className={clsx("text-lg font-semibold tabular-nums", TONE_TEXT[status.tone])}>
                {latency}
              </span>
              <span className="text-xs text-muted-foreground">ms latency</span>
            </div>
            <Sparkline
              data={samples.map((point) => point.latency)}
              tone={status.tone}
              min={0}
            />
          </div>
        </MetricShell>

        <MetricShell
          icon={Gauge}
          title="Frame Rate"
          aside={
            <span className={clsx("text-sm font-semibold tabular-nums", TONE_TEXT[fpsRating])}>
              {Math.round(fps)} fps
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-1">
              <span className={clsx("text-lg font-semibold tabular-nums", TONE_TEXT[fpsRating])}>
                {fps.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                fps · {frameTime.toFixed(1)} ms/frame
              </span>
            </div>
            <Sparkline
              data={samples.map((point) => point.fps)}
              tone={fpsRating}
              min={0}
              max={90}
            />
          </div>
        </MetricShell>
      </div>
    </div>
  );
}
