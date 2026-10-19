"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ChartArea,
  ChartBar,
  ChartColumn,
  CheckCheck,
  Code2,
  Gauge,
  MemoryStick,
  MonitorSmartphone,
  RefreshCw,
  Sparkles,
  Target,
  Terminal,
  Timer,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";

import { Drawer } from "@/components/ui/drawer";
import {
  dayKey,
  formatMinutes,
  normalizeLog,
  POMODORO_LOG_KEY,
  summarizeByDay,
  weekdayLabel,
  type SessionLog,
} from "@/lib/pomodoro";
import { useNow } from "@/lib/relative-time";
import { useLocalStorage } from "@/lib/use-local-storage";
import {
  INITIAL_BOARD,
  normalizeBoard,
  TASK_BOARD_STORAGE_KEY,
  type Board,
} from "@/components/widgets/task-board-widget";
import {
  DEFAULT_SNIPPETS,
  type Snippet,
} from "@/components/widgets/snippets-widget";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type WorkspaceAnalyticsModalProps = {
  open: boolean;
  onClose: () => void;
};

type RangeDays = 7 | 14 | 30;

type DayPoint = {
  key: string;
  timestamp: number;
  label: string;
  focusMs: number;
  work: number;
  short: number;
  long: number;
};

type Tone = "good" | "warn" | "bad";

type PerfSample = {
  t: number;
  heapMb: number | null;
  heapLimitMb: number | null;
  domNodes: number;
  fps: number;
  frameTime: number;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
  { value: 30, label: "30d" },
];

const HOUR_MS = 3_600_000;

const DEMO_FOCUS_HOURS = [1.5, 2.75, 0.75, 3.25, 4, 1.25, 2.5];
const DEMO_WORK = [3, 5, 1, 6, 7, 2, 4];
const DEMO_SHORT = [1, 2, 0, 2, 3, 1, 2];
const DEMO_LONG = [0, 1, 0, 1, 1, 0, 1];

const MAX_PERF_SAMPLES = 40;
const FPS_CEILING = 120;

const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-rose-400",
};

const TONE_STROKE: Record<Tone, string> = {
  good: "#34d399",
  warn: "#fbbf24",
  bad: "#fb7185",
};

const TONE_CHIP: Record<Tone, string> = {
  good: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/25",
  warn: "bg-amber-500/10 text-amber-400 ring-amber-400/25",
  bad: "bg-rose-500/10 text-rose-400 ring-rose-400/25",
};

const SESSION_LEGEND: { key: "work" | "short" | "long"; label: string; color: string }[] = [
  { key: "work", label: "Focus", color: "bg-emerald-500" },
  { key: "short", label: "Short break", color: "bg-sky-500" },
  { key: "long", label: "Long break", color: "bg-violet-500" },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildDemoPoints(days: number, now: number): DayPoint[] {
  const out: DayPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const timestamp = date.getTime();
    const index = (days - 1 - offset) % DEMO_FOCUS_HOURS.length;
    out.push({
      key: dayKey(timestamp),
      timestamp,
      label: weekdayLabel(timestamp),
      focusMs: DEMO_FOCUS_HOURS[index] * HOUR_MS,
      work: DEMO_WORK[index],
      short: DEMO_SHORT[index],
      long: DEMO_LONG[index],
    });
  }
  return out;
}

function buildSmoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  }
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

function fpsTone(fps: number): Tone {
  if (fps >= 55) return "good";
  if (fps >= 30) return "warn";
  return "bad";
}

function domTone(nodes: number): Tone {
  if (nodes < 1500) return "good";
  if (nodes < 3500) return "warn";
  return "bad";
}

function heapTone(used: number | null, limit: number | null): Tone {
  if (used === null || limit === null || limit <= 0) return "good";
  const ratio = used / limit;
  if (ratio < 0.6) return "good";
  if (ratio <= 0.85) return "warn";
  return "bad";
}

function worstTone(...tones: Tone[]): Tone {
  if (tones.includes("bad")) return "bad";
  if (tones.includes("warn")) return "warn";
  return "good";
}

const HEALTH_LABEL: Record<Tone, string> = {
  good: "Healthy",
  warn: "Fair",
  bad: "Degraded",
};

function readHeapMb(): { used: number | null; limit: number | null } {
  if (typeof performance === "undefined") return { used: null, limit: null };
  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    }
  ).memory;
  if (!memory || !memory.jsHeapSizeLimit) return { used: null, limit: null };
  return {
    used: memory.usedJSHeapSize / 1_048_576,
    limit: memory.jsHeapSizeLimit / 1_048_576,
  };
}

function countDomNodes(): number {
  if (typeof document === "undefined") return 0;
  return document.getElementsByTagName("*").length;
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function usePerformanceAudit(active: boolean) {
  const [samples, setSamples] = useState<PerfSample[]>([]);
  const [nonce, setNonce] = useState(0);
  const fpsRef = useRef(60);

  useEffect(() => {
    if (!active) return;

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

    const sample = (): PerfSample => {
      const fps = clamp(fpsRef.current, 1, 240);
      const heap = readHeapMb();
      return {
        t: performance.now(),
        heapMb: heap.used,
        heapLimitMb: heap.limit,
        domNodes: countDomNodes(),
        fps,
        frameTime: 1000 / fps,
      };
    };

    const seed = window.setTimeout(() => setSamples([sample()]), 0);
    const interval = window.setInterval(() => {
      setSamples((previous) => [...previous, sample()].slice(-MAX_PERF_SAMPLES));
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(seed);
      window.clearInterval(interval);
    };
  }, [active, nonce]);

  const latest = samples.length ? samples[samples.length - 1] : null;
  const refresh = () => setNonce((value) => value + 1);

  return { samples, latest, refresh };
}

/* -------------------------------------------------------------------------- */
/* Charts                                                                     */
/* -------------------------------------------------------------------------- */

function FocusAreaChart({ points }: { points: DayPoint[] }) {
  const gradientId = `focus-area-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  const height = 156;
  const padL = 8;
  const padR = 8;
  const padT = 22;
  const padB = 24;

  const hours = points.map((point) => point.focusMs / HOUR_MS);
  const maxHours = Math.max(2, Math.ceil(Math.max(...hours, 1)));
  const innerW = Math.max(0, width - padL - padR);
  const innerH = height - padT - padB;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const baseY = padT + innerH;
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  const xFor = (index: number) => padL + index * stepX;
  const yFor = (value: number) =>
    padT + innerH - (value / maxHours) * innerH;

  const coords = points.map(
    (point, index) => [xFor(index), yFor(point.focusMs / HOUR_MS)] as [number, number],
  );
  const line = buildSmoothPath(coords);
  const area =
    coords.length > 0
      ? `${line} L${xFor(points.length - 1).toFixed(2)},${baseY} L${xFor(0).toFixed(2)},${baseY} Z`
      : "";

  let peakIndex = 0;
  for (let i = 1; i < hours.length; i += 1) {
    if (hours[i] > hours[peakIndex]) peakIndex = i;
  }
  const peak = points[peakIndex];

  return (
    <div ref={ref} className="relative">
      {peak && (
        <div className="pointer-events-none absolute right-0 top-0 flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur">
          <Zap className="size-3 text-primary" />
          Peak {peak.label} · {formatMinutes(peak.focusMs / 60_000)}
        </div>
      )}
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block"
          role="img"
          aria-label="Daily focus hours area chart"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((ratio) => {
            const y = padT + innerH * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray={ratio === 0 ? "0" : "3 4"}
              />
            );
          })}

          {area && <path d={area} fill={`url(#${gradientId})`} />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {coords.map(([x, y], index) => (
            <circle
              key={points[index].key}
              cx={x}
              cy={y}
              r={index === peakIndex ? 3.4 : 2.2}
              fill="var(--background)"
              stroke="var(--primary)"
              strokeWidth={index === peakIndex ? 2 : 1.4}
            />
          ))}

          {points.map((point, index) =>
            index % labelEvery === 0 ? (
              <text
                key={`label-${point.key}`}
                x={xFor(index)}
                y={height - 7}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {point.label}
              </text>
            ) : null,
          )}
        </svg>
      )}
    </div>
  );
}

function SessionsBarChart({ points }: { points: DayPoint[] }) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  const height = 132;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 24;

  const totals = points.map((point) => point.work + point.short + point.long);
  const maxTotal = Math.max(1, ...totals);
  const innerW = Math.max(0, width - padL - padR);
  const innerH = height - padT - padB;
  const baseY = padT + innerH;
  const slot = points.length > 0 ? innerW / points.length : innerW;
  const barW = clamp(slot * 0.56, 4, 30);
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block"
          role="img"
          aria-label="Daily session breakdown bar chart"
        >
          {points.map((point, index) => {
            const center = padL + slot * index + slot / 2;
            const x = center - barW / 2;
            const clipId = `${rawId}-clip-${index}`;
            const trackY = padT;
            const trackH = innerH;

            const segments: { count: number; color: string; title: string }[] = [
              { count: point.work, color: "#10b981", title: "focus" },
              { count: point.short, color: "#0ea5e9", title: "short breaks" },
              { count: point.long, color: "#8b5cf6", title: "long breaks" },
            ];

            let cursor = baseY;
            const bars = segments.map((segment) => {
              const h = (segment.count / maxTotal) * innerH;
              const y = cursor - h;
              cursor = y;
              return { ...segment, h, y };
            });

            return (
              <g key={point.key}>
                <defs>
                  <clipPath id={clipId}>
                    <rect x={x} y={trackY} width={barW} height={trackH} rx={4} />
                  </clipPath>
                </defs>
                <rect
                  x={x}
                  y={trackY}
                  width={barW}
                  height={trackH}
                  rx={4}
                  fill="var(--muted)"
                  opacity={0.45}
                />
                <g clipPath={`url(#${clipId})`}>
                  {bars.map((bar) => (
                    <rect
                      key={bar.title}
                      x={x}
                      y={bar.y}
                      width={barW}
                      height={Math.max(0, bar.h)}
                      fill={bar.color}
                    />
                  ))}
                </g>
                <title>
                  {`${point.label}: ${totals[index]} sessions (${point.work} focus, ${point.short} short, ${point.long} long)`}
                </title>
                {index % labelEvery === 0 && (
                  <text
                    x={center}
                    y={height - 7}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    style={{ fontSize: 9 }}
                  >
                    {point.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function Sparkline({
  data,
  tone,
  min,
  max,
}: {
  data: number[];
  tone: Tone;
  min?: number;
  max?: number;
}) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
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
  const area = coords.length ? `${line} L${width},${height} L0,${height} Z` : "";
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
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
          />
          {last && <circle cx={last[0]} cy={last[1]} r="1.6" fill={stroke} vectorEffect="non-scaling-stroke" />}
        </>
      )}
    </svg>
  );
}

function PerfRing({ fps, tone, ready }: { fps: number; tone: Tone; ready: boolean }) {
  const size = 112;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = ready ? clamp((fps / FPS_CEILING) * 100, 0, 100) : 0;
  const dash = (percent / 100) * circumference;

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
        <span className={clsx("text-2xl font-semibold tabular-nums tracking-tight", TONE_TEXT[tone])}>
          {ready ? Math.round(fps) : "—"}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          fps
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function SectionHeading({
  icon: Icon,
  title,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {aside && <span className="ml-auto">{aside}</span>}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  display,
  raw,
  goal,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  display: string;
  raw: number;
  goal: number;
  sub: string;
}) {
  const percent = goal > 0 ? clamp((raw / goal) * 100, 0, 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="size-3.5" />
        </span>
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {display}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width: `${percent}%`,
            transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
    </div>
  );
}

function PerfTile({
  icon: Icon,
  label,
  value,
  unit,
  tone,
  sub,
  sparkline,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  tone: Tone;
  sub?: string;
  sparkline?: number[];
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-muted/20 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={clsx("text-lg font-semibold tabular-nums", TONE_TEXT[tone])}>
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-1.5">
          <Sparkline data={sparkline} tone={tone} />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function WorkspaceAnalyticsModal({
  open,
  onClose,
}: WorkspaceAnalyticsModalProps) {
  const [range, setRange] = useState<RangeDays>(7);
  const now = useNow(60_000);
  const ready = now > 0;

  const [logsRaw] = useLocalStorage<SessionLog[]>(POMODORO_LOG_KEY, []);
  const [boardRaw] = useLocalStorage<Board>(TASK_BOARD_STORAGE_KEY, INITIAL_BOARD);
  const [snippetsRaw] = useLocalStorage<Snippet[]>("devdesk:snippets", DEFAULT_SNIPPETS);
  const [historyRaw] = useLocalStorage<string[]>("devdesk:terminal-history", []);

  const logs = useMemo(() => normalizeLog(logsRaw), [logsRaw]);
  const board = useMemo(() => normalizeBoard(boardRaw), [boardRaw]);
  const snippets = useMemo(
    () => (Array.isArray(snippetsRaw) ? snippetsRaw : []),
    [snippetsRaw],
  );
  const history = useMemo(
    () => (Array.isArray(historyRaw) ? historyRaw : []),
    [historyRaw],
  );

  const snippetLines = useMemo(
    () =>
      snippets.reduce(
        (sum, snippet) =>
          sum +
          (snippet && typeof snippet.code === "string"
            ? snippet.code.split("\n").length
            : 0),
        0,
      ),
    [snippets],
  );

  const tasksDone = board.done.length;
  const commandsRun = history.length;

  const realPoints = useMemo<DayPoint[]>(() => {
    if (!ready) return [];
    return summarizeByDay(logs, range, now).map((summary) => ({
      key: summary.key,
      timestamp: summary.timestamp,
      label: weekdayLabel(summary.timestamp),
      focusMs: summary.focusMs,
      work: summary.workSessions,
      short: summary.shortBreaks,
      long: summary.longBreaks,
    }));
  }, [logs, range, now, ready]);

  const demoPoints = useMemo<DayPoint[]>(
    () => (ready ? buildDemoPoints(range, now) : []),
    [range, now, ready],
  );

  const realFocusMs = realPoints.reduce((sum, point) => sum + point.focusMs, 0);
  const usingSample = ready && realFocusMs === 0;
  const chartPoints = usingSample ? demoPoints : realPoints;

  const focusTotalMs = chartPoints.reduce((sum, point) => sum + point.focusMs, 0);
  const workSessions = chartPoints.reduce((sum, point) => sum + point.work, 0);
  const breakSessions = chartPoints.reduce(
    (sum, point) => sum + point.short + point.long,
    0,
  );

  const demo = useMemo(() => {
    const work = demoPoints.reduce((sum, point) => sum + point.work, 0);
    return {
      tasks: Math.round(work * 0.85),
      lines: Math.round(range * 263),
      commands: Math.round(range * 46),
    };
  }, [demoPoints, range]);

  const scale = range / 7;
  const goals = {
    focusMs: 20 * HOUR_MS * scale,
    tasks: Math.round(20 * scale),
    lines: Math.round(1500 * scale),
    commands: Math.round(250 * scale),
  };

  const displayTasks = tasksDone > 0 ? tasksDone : demo.tasks;
  const displayLines = snippetLines > 0 ? snippetLines : demo.lines;
  const displayCommands = commandsRun > 0 ? commandsRun : demo.commands;

  const avgSessionMin = workSessions > 0 ? focusTotalMs / workSessions / 60_000 : 0;

  const { samples, latest, refresh } = usePerformanceAudit(open);

  const fps = latest?.fps ?? 0;
  const domNodes = latest?.domNodes ?? 0;
  const frameTime = latest?.frameTime ?? 0;
  const heapMb = latest?.heapMb ?? null;
  const heapLimitMb = latest?.heapLimitMb ?? null;

  const hasPerf = latest !== null;
  const fpsRating = fpsTone(fps);
  const domRating = domTone(domNodes);
  const heapRating = heapTone(heapMb, heapLimitMb);
  const health = worstTone(fpsRating, domRating, heapRating);

  const heapSeries = samples
    .map((sample) => sample.heapMb)
    .filter((value): value is number => value !== null);

  const heapSub =
    heapMb !== null && heapLimitMb !== null
      ? `${Math.round((heapMb / heapLimitMb) * 100)}% of ${heapLimitMb.toFixed(0)} MB limit`
      : "Chrome-only performance.memory API";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="xl"
      title="Workspace analytics"
      description="Productivity metrics & live performance audit"
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ChartColumn className="size-4" />
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {usingSample ? (
              <>
                <Sparkles className="size-3.5 text-primary" />
                Sample data — log a focus session to see your own.
              </>
            ) : (
              <>
                <Activity className="size-3.5 text-emerald-400" />
                Live from your local workspace.
              </>
            )}
          </span>
          <button
            type="button"
            onClick={refresh}
            className="btn-surface flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Period selector */}
        <div className="flex items-center justify-between gap-3">
          <SectionHeading icon={TrendingUp} title="Usage analytics" />
          <div className="flex items-center rounded-lg border border-border bg-background/50 p-0.5">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors",
                  range === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Timer}
            label="Focus time"
            display={formatMinutes(focusTotalMs / 60_000)}
            raw={focusTotalMs}
            goal={goals.focusMs}
            sub={`Goal ${formatMinutes(goals.focusMs / 60_000)} · ${workSessions} sessions`}
          />
          <StatCard
            icon={CheckCheck}
            label="Tasks done"
            display={formatNumber(displayTasks)}
            raw={displayTasks}
            goal={goals.tasks}
            sub={`Goal ${goals.tasks} · ${breakSessions} breaks`}
          />
          <StatCard
            icon={Code2}
            label="Snippet lines"
            display={formatNumber(displayLines)}
            raw={displayLines}
            goal={goals.lines}
            sub={`Goal ${formatNumber(goals.lines)} lines`}
          />
          <StatCard
            icon={Terminal}
            label="Commands run"
            display={formatNumber(displayCommands)}
            raw={displayCommands}
            goal={goals.commands}
            sub={`Goal ${formatNumber(goals.commands)}`}
          />
        </div>

        {/* Charts */}
        {!ready ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
            Measuring activity…
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-2.5 rounded-xl border border-border p-4">
              <SectionHeading
                icon={ChartArea}
                title="Daily focus hours"
                aside={
                  <span className="text-[10px] text-muted-foreground">
                    avg {avgSessionMin > 0 ? `${Math.round(avgSessionMin)}m/session` : "—"}
                  </span>
                }
              />
              <FocusAreaChart points={chartPoints} />
            </section>

            <section className="flex flex-col gap-2.5 rounded-xl border border-border p-4">
              <SectionHeading
                icon={ChartBar}
                title="Session breakdown"
                aside={
                  <span className="flex items-center gap-2">
                    {SESSION_LEGEND.map((item) => (
                      <span
                        key={item.key}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        <span className={clsx("size-2 rounded-full", item.color)} />
                        {item.label}
                      </span>
                    ))}
                  </span>
                }
              />
              <SessionsBarChart points={chartPoints} />
            </section>
          </>
        )}

        {/* Performance audit */}
        <div className="flex flex-col gap-3">
          <SectionHeading
            icon={Gauge}
            title="Performance audit"
            aside={
              <span className="flex items-center gap-2">
                {hasPerf ? (
                  <span
                    className={clsx(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                      TONE_CHIP[health],
                    )}
                  >
                    {HEALTH_LABEL[health]}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Sampling…
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  <span className="relative flex size-2" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              </span>
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-center rounded-xl border border-border bg-muted/20 p-3">
              <PerfRing fps={fps} tone={hasPerf ? fpsRating : "good"} ready={hasPerf} />
            </div>

            <PerfTile
              icon={Activity}
              label="Frame time"
              value={hasPerf && frameTime > 0 ? frameTime.toFixed(1) : "—"}
              unit="ms/frame"
              tone={hasPerf ? fpsRating : "good"}
              sub={`${samples.length} sample${samples.length === 1 ? "" : "s"} @ 1s`}
              sparkline={samples.map((sample) => 1000 / sample.fps)}
            />

            <PerfTile
              icon={MemoryStick}
              label="JS heap"
              value={heapMb === null ? "N/A" : heapMb.toFixed(0)}
              unit={heapMb === null ? undefined : "MB"}
              tone={heapRating}
              sub={heapSub}
              sparkline={heapSeries}
            />

            <PerfTile
              icon={MonitorSmartphone}
              label="DOM nodes"
              value={hasPerf ? formatNumber(domNodes) : "—"}
              unit="nodes"
              tone={hasPerf ? domRating : "good"}
              sub="Live element count in the document tree"
              sparkline={samples.map((sample) => sample.domNodes)}
            />
          </div>

          <p className="flex items-start gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            <Target className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Heap size and DOM node counts stream from the live browser
            environment, sampled once per second while this panel is open.
          </p>
        </div>
      </div>
    </Drawer>
  );
}
