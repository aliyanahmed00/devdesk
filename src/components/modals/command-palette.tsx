"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowRight,
  ChartColumn,
  Code2,
  Command,
  Compass,
  Download,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Moon,
  Music2,
  Network,
  Palette,
  Play,
  Plug,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  SquarePen,
  Sun,
  Timer,
  Wifi,
  WifiOff,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";

import {
  THEME_META,
  THEME_ORDER,
  useTheme,
} from "@/components/providers/theme-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useMockApi } from "@/components/providers/mock-api-provider";
import type { DashboardTab } from "@/components/dashboard/dashboard-tabs";
import {
  WIDGETS,
  type WidgetId,
} from "@/components/dashboard/widget-registry";
import { useWidgetLayout } from "@/components/dashboard/widget-layout-provider";
import {
  INTEGRATION_CATALOG,
  INTEGRATION_ORDER,
  INTEGRATIONS_STORAGE_KEY,
  createDefaultState,
  type IntegrationId,
  type IntegrationsState,
} from "@/lib/integrations";
import {
  DEFAULT_SETTINGS as DEFAULT_POMODORO_SETTINGS,
  POMODORO_STORAGE_KEY,
  normalizeSettings as normalizePomodoroSettings,
  type PomodoroSettings,
} from "@/lib/pomodoro";
import {
  SEARCH_KIND_LABEL,
  useGlobalSearchIndex,
} from "@/lib/search-index";
import { useLocalStorage } from "@/lib/use-local-storage";
import {
  emitWidgetAction,
  focusWidget,
  type WidgetAction,
} from "@/lib/widget-actions";

const GROUP_ORDER = [
  "Actions",
  "Notes",
  "Tasks",
  "Snippets",
  "Commands",
  "Integrations",
  "Navigation",
  "Views",
  "Widgets",
  "Appearance",
];

const DEFAULT_INTEGRATIONS = createDefaultState();


type PaletteCommand = {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  run: () => void;
  search?: string;
  hint?: string;
  preview?: string;
  content?: boolean;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
  onNavigate: (tab: DashboardTab) => void;
  onOpenCustomize: () => void;
  onOpenSettings: () => void;
  onOpenWorkspace: () => void;
  onOpenThemeBuilder: () => void;
  onOpenTour: () => void;
  onOpenNetworkLog: () => void;
  onOpenAnalytics: () => void;
  onConnectIntegration: (id: IntegrationId) => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onOpenCustomize,
  onOpenSettings,
  onOpenWorkspace,
  onOpenThemeBuilder,
  onOpenTour,
  onOpenNetworkLog,
  onOpenAnalytics,
  onConnectIntegration,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { theme, setTheme, toggleTheme } = useTheme();
  const { isEnabled, toggle, reset } = useWidgetLayout();
  const { exportActive } = useWorkspace();
  const { toast } = useToast();
  const { offline, toggleOffline } = useMockApi();
  const router = useRouter();
  const searchResults = useGlobalSearchIndex();
  const [integrations] = useLocalStorage<IntegrationsState>(
    INTEGRATIONS_STORAGE_KEY,
    DEFAULT_INTEGRATIONS,
  );
  const [pomodoroRaw] = useLocalStorage<PomodoroSettings>(
    POMODORO_STORAGE_KEY,
    DEFAULT_POMODORO_SETTINGS,
  );
  const pomodoro = useMemo(
    () => normalizePomodoroSettings(pomodoroRaw),
    [pomodoroRaw],
  );

  const ensureEnabled = useCallback(
    (id: WidgetId) => {
      if (!isEnabled(id)) toggle(id);
    },
    [isEnabled, toggle],
  );

  const goToWidget = useCallback(
    (id: WidgetId) => {
      ensureEnabled(id);
      onNavigate("overview");
      window.setTimeout(() => focusWidget(id), 90);
    },
    [ensureEnabled, onNavigate],
  );

  const runWidgetAction = useCallback(
    (id: WidgetId, action: WidgetAction) => {
      ensureEnabled(id);
      onNavigate("overview");
      window.setTimeout(() => emitWidgetAction(action), 90);
    },
    [ensureEnabled, onNavigate],
  );

  const contentCommands = useMemo<PaletteCommand[]>(
    () =>
      searchResults.map((result) => ({
        id: `search-${result.id}`,
        label: result.title,
        group: SEARCH_KIND_LABEL[result.kind],
        hint: result.subtitle,
        preview: result.preview,
        search: result.haystack,
        content: true,
        icon: result.icon,
        run: () => {
          if (result.integration) {
            onConnectIntegration(result.integration);
            toast(`Opening ${INTEGRATION_CATALOG[result.integration].name}`, "info");
            return;
          }
          if (result.widget) goToWidget(result.widget);
        },
      })),
    [searchResults, goToWidget, onConnectIntegration, toast],
  );

  const commands = useMemo<PaletteCommand[]>(() => {
    const widgetCommands = WIDGETS.map<PaletteCommand>((widget) => ({
      id: `toggle-${widget.id}`,
      label: `${isEnabled(widget.id) ? "Hide" : "Show"} ${widget.title}`,
      group: "Widgets",
      icon: widget.icon,
      run: () => toggle(widget.id),
    }));

    const goToCommands = WIDGETS.map<PaletteCommand>((widget) => ({
      id: `goto-${widget.id}`,
      label: `Go to ${widget.title}`,
      group: "Navigation",
      icon: widget.icon,
      run: () => goToWidget(widget.id),
    }));

    const integrationCommands = INTEGRATION_ORDER.map<PaletteCommand>((id) => {
      const definition = INTEGRATION_CATALOG[id];
      const connected =
        integrations?.connections?.[id]?.status === "connected";
      return {
        id: `integration-action-${id}`,
        label: connected
          ? `${definition.name} settings`
          : `Connect ${definition.name}`,
        group: "Integrations",
        icon: Plug,
        hint: connected ? "Connected" : "Not connected",
        search: `${definition.name} ${definition.category} integration connect`.toLowerCase(),
        run: () => {
          onConnectIntegration(id);
          toast(`Opening ${definition.name}`, "info");
        },
      };
    });

    const themeIsOled = theme === "oled";
    const oledTarget = themeIsOled ? "dark" : "oled";

    return [
      {
        id: "action-pomodoro-25",
        label: `Start ${pomodoro.work}m Pomodoro`,
        group: "Actions",
        icon: Timer,
        hint: "Focus session",
        search: `start pomodoro focus timer ${pomodoro.work} minutes session`,
        run: () => {
          runWidgetAction("pomodoro", "pomodoro:start");
          toast(`Starting a ${pomodoro.work}m focus session`, "success");
        },
      },
      {
        id: "action-note",
        label: "Create new note",
        group: "Actions",
        icon: SquarePen,
        run: () => {
          runWidgetAction("notes", "notes:new");
          toast("Created a new note", "success");
        },
      },
      {
        id: "action-pomodoro",
        label: "Start / pause focus session",
        group: "Actions",
        icon: Play,
        run: () => {
          runWidgetAction("pomodoro", "pomodoro:toggle");
          toast("Pomodoro timer toggled", "info");
        },
      },
      {
        id: "action-pomodoro-reset",
        label: "Reset Pomodoro timer",
        group: "Actions",
        icon: RotateCcw,
        run: () => {
          runWidgetAction("pomodoro", "pomodoro:reset");
          toast("Pomodoro timer reset", "info");
        },
      },
      {
        id: "action-task",
        label: "Add task",
        group: "Actions",
        icon: Plus,
        run: () => {
          runWidgetAction("task-board", "task:add");
          toast("New task added", "success");
        },
      },
      {
        id: "action-snippet",
        label: "Create snippet",
        group: "Actions",
        icon: Code2,
        run: () => {
          runWidgetAction("snippets", "snippet:new");
          toast("New snippet created", "success");
        },
      },
      {
        id: "action-lofi",
        label: "Play / pause ambient sound",
        group: "Actions",
        icon: Music2,
        run: () => {
          runWidgetAction("lofi", "lofi:toggle");
          toast("Ambient sound toggled", "info");
        },
      },
      {
        id: "action-export-config",
        label: "Export Config",
        group: "Actions",
        icon: Download,
        search: "export download backup config workspace json",
        run: () => exportActive(),
      },
      ...integrationCommands,
      {
        id: "customize",
        label: "Customize dashboard",
        group: "Layout",
        icon: SlidersHorizontal,
        run: () => onOpenCustomize(),
      },
      {
        id: "workspaces",
        label: "Manage workspaces & backups",
        group: "Layout",
        icon: Layers,
        run: () => onOpenWorkspace(),
      },
      {
        id: "settings",
        label: "Open settings",
        group: "Layout",
        icon: Settings2,
        run: () => onOpenSettings(),
      },
      {
        id: "tour",
        label: "Start guided tour",
        group: "Help",
        icon: Compass,
        run: () => onOpenTour(),
      },
      {
        id: "network-log",
        label: "Open network activity",
        group: "Developer",
        icon: Network,
        run: () => onOpenNetworkLog(),
      },
      {
        id: "analytics",
        label: "Open workspace analytics",
        group: "Developer",
        icon: ChartColumn,
        run: () => onOpenAnalytics(),
      },
      {
        id: "network-offline",
        label: offline ? "Go back online" : "Simulate offline mode",
        group: "Developer",
        icon: offline ? Wifi : WifiOff,
        run: () => {
          toggleOffline();
          toast(
            offline ? "Back online" : "Simulated offline mode enabled",
            offline ? "success" : "info",
          );
        },
      },
      {
        id: "reset",
        label: "Reset widgets to defaults",
        group: "Layout",
        icon: RotateCcw,
        run: () => {
          reset();
          toast("Widgets reset to defaults", "info");
        },
      },
      {
        id: "view-overview",
        label: "Overview",
        group: "Views",
        icon: LayoutDashboard,
        run: () => onNavigate("overview"),
      },
      {
        id: "view-widgets",
        label: "Widget gallery",
        group: "Views",
        icon: LayoutGrid,
        run: () => onNavigate("widgets"),
      },
      {
        id: "view-integrations",
        label: "Integrations",
        group: "Views",
        icon: Plug,
        run: () => onNavigate("integrations"),
      },
      {
        id: "theme-oled-toggle",
        label: themeIsOled
          ? "Toggle theme to Dark"
          : "Toggle Theme to OLED",
        group: "Appearance",
        icon: themeIsOled ? Moon : Zap,
        search: "toggle theme oled cyberpunk dark appearance",
        run: () => {
          setTheme(oledTarget);
          toast(`Theme: ${THEME_META[oledTarget].label}`, "info");
        },
      },
      {
        id: "theme-toggle",
        label: "Toggle theme",
        group: "Appearance",
        icon: Sun,
        run: () => {
          toggleTheme();
          toast("Theme toggled", "info");
        },
      },
      {
        id: "theme-builder",
        label: "Open theme builder",
        group: "Appearance",
        icon: Palette,
        run: () => onOpenThemeBuilder(),
      },
      ...THEME_ORDER.map<PaletteCommand>((id) => ({
        id: `theme-${id}`,
        label: `Theme: ${THEME_META[id].label}`,
        group: "Appearance",
        icon: THEME_META[id].icon,
        run: () => {
          setTheme(id);
          toast(`Theme: ${THEME_META[id].label}`, "info");
        },
      })),
      ...widgetCommands,
      ...contentCommands,
      ...goToCommands,
      {
        id: "goto-login",
        label: "Go to sign in",
        group: "Navigation",
        icon: ArrowRight,
        run: () => {
          router.push("/login");
        },
      },
    ];
  }, [
    isEnabled,
    toggle,
    reset,
    theme,
    setTheme,
    toggleTheme,
    exportActive,
    integrations,
    pomodoro,
    runWidgetAction,
    goToWidget,
    onNavigate,
    onOpenCustomize,
    onOpenSettings,
    onOpenWorkspace,
    onOpenThemeBuilder,
    onOpenTour,
    onOpenNetworkLog,
    onOpenAnalytics,
    onConnectIntegration,
    offline,
    toggleOffline,
    contentCommands,
    toast,
    router,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.filter((command) => !command.content);
    return commands.filter((command) =>
      `${command.label} ${command.group} ${command.search ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [commands, query]);

  const sections = useMemo(() => {
    const map = new Map<string, { command: PaletteCommand; index: number }[]>();
    filtered.forEach((command, index) => {
      const list = map.get(command.group) ?? [];
      list.push({ command, index });
      map.set(command.group, list);
    });
    const ordered = [
      ...GROUP_ORDER,
      ...Array.from(map.keys()).filter((group) => !GROUP_ORDER.includes(group)),
    ];
    return ordered
      .filter((group) => map.has(group))
      .map((group) => ({ group, items: map.get(group) ?? [] }));
  }, [filtered]);

  const active =
    filtered.length === 0 ? -1 : Math.min(activeIndex, filtered.length - 1);

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`palette-item-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setActiveIndex(0);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function runCommand(index: number) {
    const command = filtered[index];
    if (!command) return;
    command.run();
    close();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runCommand(active);
    } else if (event.key === "Escape") {
      close();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
      <div
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Universal search"
        className="animate-slide-down relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 text-card-foreground shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4">
          <Command className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search notes, tasks, snippets, integrations, commands…"
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div className="scrollbar-thin max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No results match “{query}”.
            </p>
          ) : (
            <div className="flex flex-col">
              {sections.map((section) => (
                <div key={section.group} className="flex flex-col">
                  <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {section.group}
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {section.items.map(({ command, index }) => {
                      const Icon = command.icon;
                      return (
                        <li key={command.id} id={`palette-item-${index}`}>
                          <button
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => runCommand(index)}
                            className={clsx(
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                              index === active
                                ? "bg-zinc-800/70 text-foreground"
                                : "text-muted-foreground hover:bg-zinc-800/40",
                            )}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-foreground">
                                {command.label}
                              </span>
                              {command.preview ? (
                                <span className="truncate font-mono text-[11px] text-muted-foreground/80">
                                  {command.preview}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {command.hint ?? command.group}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-800 px-1 py-0.5">↑</kbd>
              <kbd className="rounded border border-zinc-800 px-1 py-0.5">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-800 px-1 py-0.5">↵</kbd>
              select
            </span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-800 px-1 py-0.5">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
