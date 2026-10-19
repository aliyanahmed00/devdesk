"use client";

import { useMemo } from "react";
import { Network, Trash2 } from "lucide-react";
import { clsx } from "clsx";

import { useMockApi } from "@/components/providers/mock-api-provider";
import { Drawer } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import {
  FAILURE_STATUS_OPTIONS,
  statusLabel,
  STATUS_TEXT,
  type ApiFailureStatus,
  type HttpMethod,
  type RequestLogEntry,
} from "@/lib/api-client";

type RequestLoggerDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const METHOD_CLASS: Record<HttpMethod, string> = {
  GET: "bg-sky-500/10 text-sky-400 ring-sky-500/30",
  POST: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  PUT: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  PATCH: "bg-violet-500/10 text-violet-400 ring-violet-500/30",
  DELETE: "bg-rose-500/10 text-rose-400 ring-rose-500/30",
};

function statusClass(status: number): string {
  if (status === 0) return "bg-rose-500/10 text-rose-400 ring-rose-500/30";
  if (status >= 500) return "bg-rose-500/10 text-rose-400 ring-rose-500/30";
  if (status >= 400) return "bg-amber-500/10 text-amber-400 ring-amber-500/30";
  return "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30";
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatTime(at: number): string {
  return timeFormatter.format(new Date(at));
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "rose" | "emerald";
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={clsx(
          "mt-0.5 text-base font-semibold tabular-nums",
          tone === "rose"
            ? "text-rose-400"
            : tone === "emerald"
              ? "text-emerald-400"
              : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LogRow({ entry }: { entry: RequestLogEntry }) {
  return (
    <li className="rounded-lg border border-border/70 bg-card/40 p-2.5">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ring-1 ring-inset",
            METHOD_CLASS[entry.method],
          )}
        >
          {entry.method}
        </span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
          title={entry.url}
        >
          {entry.url}
        </span>
        <span
          className={clsx(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ring-1 ring-inset",
            statusClass(entry.status),
          )}
          title={STATUS_TEXT[entry.status] ?? "Network failure"}
        >
          {statusLabel(entry.status)}
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {entry.latency}ms
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{formatTime(entry.at)}</span>
        {entry.source && <span>· {entry.source}</span>}
        {entry.error && <span className="text-rose-400/90">· {entry.error}</span>}
      </div>

      {entry.payload !== undefined && (
        <pre className="scrollbar-thin mt-1.5 max-h-24 overflow-auto rounded-md border border-border/60 bg-background/60 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {JSON.stringify(entry.payload, null, 2)}
        </pre>
      )}
    </li>
  );
}

export function RequestLoggerDrawer({ open, onClose }: RequestLoggerDrawerProps) {
  const { config, updateConfig, resetConfig, log, clearLog } = useMockApi();

  const stats = useMemo(() => {
    const failed = log.filter((entry) => !entry.ok).length;
    const totalLatency = log.reduce((sum, entry) => sum + entry.latency, 0);
    const avg = log.length === 0 ? 0 : Math.round(totalLatency / log.length);
    return { total: log.length, failed, avg };
  }, [log]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      title="Network activity"
      description="Mock API request log & simulated conditions"
      icon={
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Network className="size-4" />
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {config.offline
              ? "Offline mode active — all requests fail."
              : `${stats.total} request${stats.total === 1 ? "" : "s"} this session`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetConfig}
              className="btn-surface rounded-lg px-3 py-2 text-xs font-medium"
            >
              Reset conditions
            </button>
            <button
              type="button"
              onClick={clearLog}
              disabled={log.length === 0}
              className="btn-surface flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
              Clear log
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4 rounded-xl border border-border p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Simulate offline
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Reject every request like a dropped connection.
              </p>
            </div>
            <Switch
              checked={config.offline}
              onChange={(value) => updateConfig({ offline: value })}
              label="Simulate offline mode"
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Mock latency &amp; failures
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Master switch for the whole API layer.
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onChange={(value) => updateConfig({ enabled: value })}
              label="Enable mock API layer"
            />
          </div>

          <div
            className={clsx(
              "flex flex-col gap-3 border-t border-border pt-3.5 transition-opacity",
              !config.enabled && "pointer-events-none opacity-40",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Latency window
              </span>
              <span className="font-mono text-xs tabular-nums text-foreground">
                {config.latencyMin}–{config.latencyMax}ms
              </span>
            </div>
            <label className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="w-7 tabular-nums">min</span>
              <input
                type="range"
                min={0}
                max={2000}
                step={50}
                value={config.latencyMin}
                onChange={(event) =>
                  updateConfig({
                    latencyMin: Math.min(
                      Number(event.target.value),
                      config.latencyMax,
                    ),
                  })
                }
                className="range-touch flex-1"
                aria-label="Minimum latency in milliseconds"
              />
            </label>
            <label className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="w-7 tabular-nums">max</span>
              <input
                type="range"
                min={0}
                max={3000}
                step={50}
                value={config.latencyMax}
                onChange={(event) =>
                  updateConfig({
                    latencyMax: Math.max(
                      Number(event.target.value),
                      config.latencyMin,
                    ),
                  })
                }
                className="range-touch flex-1"
                aria-label="Maximum latency in milliseconds"
              />
            </label>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Failure rate
              </span>
              <span className="font-mono text-xs tabular-nums text-foreground">
                {Math.round(config.failRate * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(config.failRate * 100)}
              onChange={(event) =>
                updateConfig({ failRate: Number(event.target.value) / 100 })
              }
              className="range-touch w-full"
              aria-label="Failure rate percentage"
            />

            <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              Failure status
              <select
                value={config.failureStatus}
                onChange={(event) =>
                  updateConfig({
                    failureStatus: Number(event.target.value) as ApiFailureStatus,
                  })
                }
                className="w-52 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
              >
                {FAILURE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Requests" value={stats.total} />
          <Stat label="Failed" value={stats.failed} tone="rose" />
          <Stat label="Avg latency" value={`${stats.avg}ms`} />
        </div>

        <section>
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {"// requests"}
          </h3>
          {log.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No requests logged yet.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {log.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  );
}
