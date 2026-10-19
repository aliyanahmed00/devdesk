"use client";

import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import {
  Activity,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  LoaderCircle,
  Plug,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unplug,
} from "lucide-react";
import { clsx } from "clsx";

import { useToast } from "@/components/providers/toast-provider";
import {
  DockerIcon,
  FigmaIcon,
  GitHubIcon,
  LinearIcon,
  SupabaseIcon,
  VercelIcon,
} from "@/components/ui/brand-icons";
import { Drawer } from "@/components/ui/drawer";
import {
  INTEGRATION_CATALOG,
  INTEGRATION_ORDER,
  INTEGRATIONS_STORAGE_KEY,
  createDefaultState,
  fillSyncMessage,
  type IntegrationConnection,
  type IntegrationDefinition,
  type IntegrationId,
  type IntegrationStatus,
  type IntegrationsState,
  type SyncEvent,
  type SyncTone,
} from "@/lib/integrations";
import { useOpenIntegration } from "@/lib/integration-actions";
import { formatClockTime, formatRelativeTime, useNow } from "@/lib/relative-time";
import { useLocalStorage } from "@/lib/use-local-storage";

type BrandIcon = ComponentType<SVGProps<SVGSVGElement>>;

const BRAND_ICONS: Record<IntegrationId, BrandIcon> = {
  github: GitHubIcon,
  vercel: VercelIcon,
  docker: DockerIcon,
  supabase: SupabaseIcon,
  figma: FigmaIcon,
  linear: LinearIcon,
};

const DEFAULT_STATE = createDefaultState();

const STATUS_META: Record<
  IntegrationStatus,
  { label: string; badge: string; dot: string }
> = {
  connected: {
    label: "Connected",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
  },
  disconnected: {
    label: "Disconnected",
    badge: "border-border bg-muted/40 text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  syncing: {
    label: "Syncing",
    badge: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
};

const TONE_META: Record<SyncTone, { text: string; dot: string }> = {
  success: { text: "text-emerald-400", dot: "bg-emerald-400" },
  info: { text: "text-sky-400", dot: "bg-sky-400" },
  error: { text: "text-rose-400", dot: "bg-rose-400" },
};

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function missingFields(
  definition: IntegrationDefinition,
  values: Record<string, string>,
) {
  return definition.fields.filter(
    (field) => !field.optional && !(values[field.key] ?? "").trim(),
  );
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        meta.badge,
      )}
    >
      <span className="relative flex size-1.5">
        {status !== "disconnected" && (
          <span
            className={clsx(
              "absolute inline-flex size-full rounded-full opacity-75",
              status === "connected" && "animate-ping",
              meta.dot,
            )}
          />
        )}
        <span
          className={clsx("relative inline-flex size-1.5 rounded-full", meta.dot)}
        />
      </span>
      {meta.label}
    </span>
  );
}

export function IntegrationsView() {
  const { toast } = useToast();
  const [state, setState] = useLocalStorage<IntegrationsState>(
    INTEGRATIONS_STORAGE_KEY,
    DEFAULT_STATE,
  );
  const now = useNow(15_000);

  const [activeId, setActiveId] = useState<IntegrationId | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "fail">("idle");
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const activeDef = activeId ? INTEGRATION_CATALOG[activeId] : null;
  const activeConn = activeId ? state.connections[activeId] : null;
  const ActiveIcon = activeId ? BRAND_ICONS[activeId] : null;

  const connectedCount = useMemo(
    () =>
      INTEGRATION_ORDER.filter(
        (id) => state.connections[id].status === "connected",
      ).length,
    [state.connections],
  );

  function mutate(
    id: IntegrationId,
    updater: (connection: IntegrationConnection) => IntegrationConnection,
    event?: { message: string; tone: SyncTone },
  ) {
    setState((prev) => ({
      ...prev,
      connections: { ...prev.connections, [id]: updater(prev.connections[id]) },
      events: event
        ? [
            {
              id: uid(),
              integrationId: id,
              message: event.message,
              tone: event.tone,
              at: Date.now(),
            },
            ...prev.events,
          ].slice(0, 60)
        : prev.events,
    }));
  }

  function openConfigure(id: IntegrationId) {
    setActiveId(id);
    setDraft({ ...state.connections[id].values });
    setReveal({});
    setTesting(false);
    setTestResult("idle");
    setConfirmingDisconnect(false);
    setActivityOpen(false);
  }

  function closeConfigure() {
    setActiveId(null);
    setTesting(false);
    setTestResult("idle");
    setConfirmingDisconnect(false);
  }

  useOpenIntegration(openConfigure);

  async function handleTest() {
    if (!activeId || !activeDef) return;

    setTesting(true);
    setTestResult("idle");
    await delay(800 + Math.random() * 700);

    const missing = missingFields(activeDef, draft);
    if (missing.length > 0) {
      setTesting(false);
      setTestResult("fail");
      toast(`Add your ${missing[0].label.toLowerCase()} first`, "error");
      return;
    }

    const ok = Math.random() > 0.15;
    setTesting(false);
    setTestResult(ok ? "ok" : "fail");

    if (ok) {
      mutate(
        activeId,
        (connection) => ({
          ...connection,
          status: "connected",
          values: { ...draft },
          lastSyncedAt: connection.lastSyncedAt ?? Date.now(),
        }),
        { message: "Connection test passed", tone: "info" },
      );
      toast(`${activeDef.name} connection verified`, "success");
    } else {
      mutate(activeId, (connection) => connection, {
        message: "Connection test failed — request timed out",
        tone: "error",
      });
      toast(`Could not reach ${activeDef.name} — check your token`, "error");
    }
  }

  function handleSave() {
    if (!activeId || !activeDef) return;
    const missing = missingFields(activeDef, draft);
    if (missing.length > 0) {
      toast(`Add your ${missing[0].label.toLowerCase()} first`, "error");
      return;
    }
    mutate(
      activeId,
      (connection) => ({
        ...connection,
        status: "connected",
        values: { ...draft },
        lastSyncedAt: Date.now(),
      }),
      { message: "Connected successfully", tone: "success" },
    );
    toast(`${activeDef.name} connected`, "success");
    closeConfigure();
  }

  function handleDisconnect() {
    if (!activeId || !activeDef) return;
    mutate(activeId, () => ({ status: "disconnected", values: {}, lastSyncedAt: null }), {
      message: "Disconnected",
      tone: "info",
    });
    toast(`${activeDef.name} disconnected`, "info");
    closeConfigure();
  }

  function syncService(id: IntegrationId) {
    const definition = INTEGRATION_CATALOG[id];
    mutate(id, (connection) => ({ ...connection, status: "syncing" }));

    window.setTimeout(
      () => {
        const template =
          definition.syncMessages[
            Math.floor(Math.random() * definition.syncMessages.length)
          ];
        const message = fillSyncMessage(template);
        let applied = false;
        setState((prev): IntegrationsState => {
          const connection = prev.connections[id];
          if (connection.status !== "syncing") return prev;
          applied = true;
          const event: SyncEvent = {
            id: uid(),
            integrationId: id,
            message,
            tone: "success",
            at: Date.now(),
          };
          return {
            ...prev,
            connections: {
              ...prev.connections,
              [id]: { ...connection, status: "connected", lastSyncedAt: Date.now() },
            },
            events: [event, ...prev.events].slice(0, 60),
          };
        });
        if (applied) toast(`${definition.name}: ${message}`, "success");
      },
      1100 + Math.random() * 800,
    );
  }

  function syncAll() {
    const targets = INTEGRATION_ORDER.filter(
      (id) => state.connections[id].status === "connected",
    );
    if (targets.length === 0) {
      toast("Connect an integration first", "info");
      return;
    }
    targets.forEach((id) => syncService(id));
  }

  function clearEvents() {
    setState((prev) => ({ ...prev, events: [] }));
    toast("Activity log cleared", "info");
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            {"// integrations"}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
            Integrations Hub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect the developer tools that power your workspace —{" "}
            {connectedCount} of {INTEGRATION_ORDER.length} connected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={syncAll}
            className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <RefreshCw className="size-4 opacity-80" />
            Sync all
          </button>
          <button
            type="button"
            onClick={() => {
              setActivityOpen(true);
              setActiveId(null);
            }}
            className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <Activity className="size-4 opacity-80" />
            Activity
            <span className="rounded-full bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {state.events.length}
            </span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATION_ORDER.map((id) => {
          const definition = INTEGRATION_CATALOG[id];
          const connection = state.connections[id];
          const Icon = BRAND_ICONS[id];
          const syncing = connection.status === "syncing";
          const hasConnection = connection.status !== "disconnected";

          return (
            <article
              key={id}
              className="glass card-hover card-rim flex flex-col gap-4 overflow-hidden rounded-xl p-5 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={clsx(
                    "flex size-11 items-center justify-center rounded-xl ring-1 ring-inset",
                    definition.tile,
                  )}
                >
                  <Icon className={clsx("size-6", definition.glyph)} />
                </span>
                <StatusBadge status={connection.status} />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    {definition.name}
                  </h3>
                  <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {definition.category}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {definition.description}
                </p>
                {hasConnection && connection.lastSyncedAt && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <RefreshCw className="size-3" />
                    Last synced {formatRelativeTime(connection.lastSyncedAt, now)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {hasConnection ? (
                  <>
                    <button
                      type="button"
                      onClick={() => syncService(id)}
                      disabled={syncing}
                      className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60"
                    >
                      {syncing ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      {syncing ? "Syncing…" : "Sync now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openConfigure(id)}
                      className="btn-surface flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                    >
                      Configure
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConfigure(id)}
                    className="btn-surface flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    <Plus className="size-4" />
                    Connect
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Drawer
        open={activeId !== null && activeDef !== null}
        onClose={closeConfigure}
        title={activeDef ? `Connect ${activeDef.name}` : ""}
        description={activeDef?.description}
        icon={
          activeDef && ActiveIcon ? (
            <span
              className={clsx(
                "flex size-10 items-center justify-center rounded-lg ring-1 ring-inset",
                activeDef.tile,
              )}
            >
              <ActiveIcon className={clsx("size-5", activeDef.glyph)} />
            </span>
          ) : undefined
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            {activeConn && activeConn.status !== "disconnected" ? (
              confirmingDisconnect ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDisconnect(false)}
                    className="btn-surface rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDisconnect(true)}
                  className="flex items-center gap-2 rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
                >
                  <Unplug className="size-4" />
                  Disconnect
                </button>
              )
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            >
              <Check className="size-4" />
              Save &amp; connect
            </button>
          </div>
        }
      >
        {activeDef && (
          <div className="flex flex-col gap-4">
            {activeDef.fields.map((field) => {
              const isPassword = field.type === "password";
              const revealed = Boolean(reveal[field.key]);
              const inputType = isPassword && !revealed ? "password" : field.type;

              return (
                <div key={field.key}>
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`integration-${field.key}`}
                      className="text-xs font-medium text-foreground"
                    >
                      {field.label}
                      {field.optional && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          (optional)
                        </span>
                      )}
                    </label>
                    {isPassword && (
                      <button
                        type="button"
                        onClick={() =>
                          setReveal((current) => ({
                            ...current,
                            [field.key]: !current[field.key],
                          }))
                        }
                        className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {revealed ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                        {revealed ? "Hide" : "Show"}
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                    {isPassword ? (
                      <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                    ) : field.type === "url" ? (
                      <Link2 className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Plug className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <input
                      id={`integration-${field.key}`}
                      type={inputType}
                      value={draft[field.key] ?? ""}
                      placeholder={field.placeholder}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }));
                        if (testResult !== "idle") setTestResult("idle");
                      }}
                      className="w-full bg-transparent py-2 text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>
                  {field.hint && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {field.hint}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60"
              >
                {testing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {testing ? "Testing…" : "Test connection"}
              </button>
              {testResult === "ok" && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Check className="size-4" />
                  Verified
                </span>
              )}
              {testResult === "fail" && (
                <span className="flex items-center gap-1.5 text-xs text-rose-400">
                  <Unplug className="size-4" />
                  Failed
                </span>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              Credentials are stored only in this browser&apos;s localStorage.
              This is a mock connection used to demonstrate the workflow — no
              requests leave your device.
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        title="Activity log"
        description="Automated sync events across your integrations."
        width="lg"
        icon={
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
            <Activity className="size-5" />
          </span>
        }
        footer={
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {state.events.length} event{state.events.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={clearEvents}
              disabled={state.events.length === 0}
              className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              Clear log
            </button>
          </div>
        }
      >
        {state.events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <Activity className="size-6" />
            No activity yet. Sync an integration to see events here.
          </div>
        ) : (
          <ul className="flex flex-col">
            {state.events.map((event: SyncEvent) => {
              const definition = INTEGRATION_CATALOG[event.integrationId];
              const Icon = BRAND_ICONS[event.integrationId];
              const tone = TONE_META[event.tone];
              return (
                <li
                  key={event.id}
                  className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0"
                >
                  <span
                    className={clsx(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                      definition.tile,
                    )}
                  >
                    <Icon className={clsx("size-4", definition.glyph)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{definition.name}:</span>{" "}
                      <span className={tone.text}>{event.message}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelativeTime(event.at, now)} ·{" "}
                      {formatClockTime(event.at)}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      tone.dot,
                    )}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Drawer>
    </div>
  );
}
