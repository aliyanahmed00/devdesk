"use client";

import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import {
  ChartColumn,
  Download,
  Keyboard,
  Layers,
  LayoutDashboard,
  Moon,
  Network,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";

import { focusWidget } from "@/lib/widget-actions";
import { detectMac, formatCombo, HOTKEYS } from "@/lib/hotkeys";
import { removeStorageRaw, writeStorageRaw } from "@/lib/use-local-storage";
import { emptyNotesState } from "@/lib/notes";
import { CommandPalette } from "@/components/modals/command-palette";
import { KeyboardShortcutsModal } from "@/components/modals/keyboard-shortcuts-modal";
import {
  OnboardingTour,
  TOUR_STORAGE_KEY,
} from "@/components/modals/onboarding-tour";
import { ThemeBuilderModal } from "@/components/modals/theme-builder-modal";
import { WorkspaceManagerModal } from "@/components/modals/workspace-manager-modal";
import { WorkspaceAnalyticsModal } from "@/components/modals/workspace-analytics-modal";
import {
  ContextMenu,
  useContextMenu,
  type ContextMenuItem,
} from "@/components/ui/context-menu";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { Modal } from "@/components/ui/modal";
import { SettingsDrawer } from "@/components/modals/settings-drawer";
import {
  HotkeysProvider,
  useGlobalHotkeys,
  useHotkeys,
} from "@/components/providers/hotkeys-provider";
import {
  WorkspaceProvider,
  useWorkspace,
} from "@/components/providers/workspace-provider";
import { CollabPresenceProvider } from "@/components/providers/collab-presence-provider";
import { MeshBackgroundProvider } from "@/components/providers/mesh-background-provider";
import { MockApiProvider } from "@/components/providers/mock-api-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { LofiProvider } from "@/components/providers/lofi-provider";
import { SoundEffectsProvider } from "@/components/providers/sound-provider";
import { useToast } from "@/components/providers/toast-provider";
import { emitOpenIntegration } from "@/lib/integration-actions";
import type { IntegrationId } from "@/lib/integrations";

import { CustomizePanel } from "./customize-panel";
import { CollabCursorOverlay, CollabPresence } from "./collab-presence";
import { FocusOverlay } from "./focus-overlay";
import {
  DASHBOARD_TABS,
  type DashboardTab,
} from "./dashboard-tabs";
import { HeaderClock } from "./header-clock";
import { IntegrationsView } from "./integrations-view";
import { MobileMenu } from "./mobile-menu";
import { LofiMiniPlayer } from "./lofi-mini-player";
import { RequestLoggerDrawer } from "./request-logger-drawer";
import { StatusBar } from "./status-bar";
import { StatusIndicator } from "./status-indicator";
import { ThemeToggle } from "./theme-toggle";
import { WIDGETS, getWidget, type WidgetDefinition, type WidgetId } from "./widget-registry";
import { WidgetLayoutProvider, useWidgetLayout } from "./widget-layout-provider";
import { WidgetGrid } from "./widget-grid";
import { WidgetsView } from "./widgets-view";
import { WorkspaceSwitcher } from "./workspace-switcher";


export function Dashboard() {
  return (
    <MeshBackgroundProvider>
      <MockApiProvider>
        <WorkspaceProvider>
          <WidgetLayoutProvider>
            <HotkeysProvider>
              <LofiProvider>
                <SoundEffectsProvider>
                  <CollabPresenceProvider>
                    <DashboardShell />
                  </CollabPresenceProvider>
                </SoundEffectsProvider>
              </LofiProvider>
            </HotkeysProvider>
          </WidgetLayoutProvider>
        </WorkspaceProvider>
      </MockApiProvider>
    </MeshBackgroundProvider>
  );
}

function DashboardShell() {
  const { enabled, reset } = useWidgetLayout();
  const { getCombo } = useHotkeys();
  const { exportActive } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { position: menuPosition, openAt: openMenuAt, close: closeMenu } =
    useContextMenu();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [themeBuilderOpen, setThemeBuilderOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<WidgetId | null>(null);

  function openIntegration(id: IntegrationId) {
    setActiveTab("integrations");
    window.setTimeout(() => emitOpenIntegration(id), 90);
  }

  useGlobalHotkeys(
    {
      palette: () => setPaletteOpen((value) => !value),
      customize: () => setCustomizeOpen((value) => !value),
      settings: () => setSettingsOpen((value) => !value),
      focus: () => setFocusMode((value) => !value),
      "view-overview": () => setActiveTab("overview"),
      "view-widgets": () => setActiveTab("widgets"),
      "view-integrations": () => setActiveTab("integrations"),
      close: () => {
        setPaletteOpen(false);
        setCustomizeOpen(false);
        setSettingsOpen(false);
        setShortcutsOpen(false);
        setWorkspaceOpen(false);
        setThemeBuilderOpen(false);
        setNetworkOpen(false);
        setAnalyticsOpen(false);
      },
    },
    (id) => {
      const def = HOTKEYS.find((hotkey) => hotkey.id === id);
      if (!def) return;
      toast(`${formatCombo(getCombo(id), detectMac())} · ${def.label}`, "info");
    },
  );

  const visible = useMemo(
    () =>
      enabled
        .map((id) => getWidget(id))
        .filter((widget): widget is WidgetDefinition => widget !== undefined),
    [enabled],
  );

  const expanded = useMemo(
    () => WIDGETS.find((widget) => widget.id === expandedId) ?? null,
    [expandedId],
  );
  const ExpandedComponent = expanded?.component;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (paletteOpen || customizeOpen || settingsOpen || expandedId) return;
      if (activeTab !== "overview") return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      const index = Number.parseInt(event.key, 10);
      if (Number.isNaN(index) || index < 1 || index > visible.length) return;

      event.preventDefault();
      focusWidget(visible[index - 1].id);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, paletteOpen, customizeOpen, settingsOpen, expandedId, activeTab]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      let completed = false;
      try {
        completed = window.localStorage.getItem(TOUR_STORAGE_KEY) === "true";
      } catch {
        completed = false;
      }
      if (!completed) setTourOpen(true);
    }, 1000);
    return () => window.clearTimeout(id);
  }, []);

  function finishTour() {
    writeStorageRaw(TOUR_STORAGE_KEY, "true");
    setTourOpen(false);
    toast("Tour complete — you're all set!", "success");
  }

  function restartTour() {
    removeStorageRaw(TOUR_STORAGE_KEY);
    setSettingsOpen(false);
    setTourOpen(true);
  }

  const contextItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        id: "add-widget",
        label: "Add New Widget",
        icon: Plus,
        onSelect: () => setCustomizeOpen(true),
      },
      {
        id: "reset-layout",
        label: "Reset Layout",
        icon: RotateCcw,
        onSelect: () => {
          reset();
          toast("Layout reset to defaults", "info");
        },
      },
      {
        id: "toggle-theme",
        label:
          theme === "oled" ? "Switch to Dark Mode" : "Switch to OLED Mode",
        icon: theme === "oled" ? Moon : Zap,
        onSelect: () => setTheme(theme === "oled" ? "dark" : "oled"),
      },
      {
        id: "export-config",
        label: "Export Config",
        icon: Download,
        onSelect: () => exportActive(),
      },
      {
        id: "network",
        label: "Network activity",
        icon: Network,
        onSelect: () => setNetworkOpen(true),
      },
      {
        id: "analytics",
        label: "Workspace analytics",
        icon: ChartColumn,
        onSelect: () => setAnalyticsOpen(true),
      },
      {
        id: "clear-notes",
        label: "Clear All Notes",
        icon: Trash2,
        danger: true,
        onSelect: () => {
          writeStorageRaw("devdesk:notes", JSON.stringify(emptyNotesState()));
          toast("All notes cleared", "info");
        },
      },
    ],
    [reset, toast, theme, setTheme, exportActive],
  );

  function handleContextMenu(event: ReactMouseEvent<HTMLElement>) {
    if (focusMode) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        "input, textarea, select, [contenteditable='true'], a, button",
      )
    ) {
      return;
    }
    event.preventDefault();
    openMenuAt(event.clientX, event.clientY);
  }

  useEffect(() => {
    if (!focusMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (
        paletteOpen ||
        customizeOpen ||
        settingsOpen ||
        shortcutsOpen ||
        workspaceOpen ||
        themeBuilderOpen ||
        networkOpen ||
        analyticsOpen ||
        tourOpen ||
        expandedId
      ) {
        return;
      }
      setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    focusMode,
    paletteOpen,
    customizeOpen,
    settingsOpen,
    shortcutsOpen,
    workspaceOpen,
    themeBuilderOpen,
    networkOpen,
    analyticsOpen,
    tourOpen,
    expandedId,
  ]);

  return (
    <div className="relative flex min-h-full flex-1 flex-col text-foreground">
      <header
        className={clsx(
          "sticky top-0 z-30 w-full border-b border-border/80 bg-background/80 backdrop-blur-md transition-opacity duration-500",
          focusMode && "pointer-events-none opacity-0",
        )}
      >
        <div className="flex h-16 w-full items-center gap-3 px-6 lg:px-10">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <LayoutDashboard className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">DevDesk</span>
          </Link>

          <nav
            aria-label="Primary"
            className="ml-1 hidden h-16 items-center md:flex"
          >
            {DASHBOARD_TABS.map((tab) => {
              const active = tab.id === activeTab;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-tour={tab.id === "integrations" ? "integrations" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "group/tab relative isolate flex h-16 items-center gap-2 px-3.5 text-sm font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-x-1.5 inset-y-2.5 -z-10 rounded-lg bg-muted/60"
                    />
                  )}
                  <Icon className="size-4" />
                  {tab.label}
                  <span
                    aria-hidden
                    className={clsx(
                      "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary transition-opacity",
                      active
                        ? "opacity-100 shadow-[0_0_10px_rgb(var(--glow)/0.9)]"
                        : "opacity-0 group-hover/tab:opacity-40",
                    )}
                  />
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <StatusIndicator />
            <HeaderClock />
            <CollabPresence />
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                data-tour="search"
                onClick={() => setPaletteOpen(true)}
                className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <Search className="size-4 opacity-70" />
                <span className="hidden lg:inline">Search…</span>
                <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </button>
              <ThemeToggle onOpenThemeBuilder={() => setThemeBuilderOpen(true)} />
              <button
                type="button"
                onClick={() => setWorkspaceOpen(true)}
                aria-label="Workspace manager"
                title="Workspace manager"
                className="btn-surface flex size-9 items-center justify-center rounded-lg"
              >
                <Layers className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts"
                className="btn-surface flex size-9 items-center justify-center rounded-lg"
              >
                <Keyboard className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setNetworkOpen(true)}
                data-sound="swoosh"
                aria-label="Network activity"
                title="Network activity"
                className="btn-surface flex size-9 items-center justify-center rounded-lg"
              >
                <Network className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsOpen(true)}
                aria-label="Workspace analytics"
                title="Workspace analytics"
                className="btn-surface flex size-9 items-center justify-center rounded-lg"
              >
                <ChartColumn className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                data-sound="swoosh"
                aria-label="Open settings"
                title="Settings"
                className="btn-surface flex size-9 items-center justify-center rounded-lg"
              >
                <Settings className="size-4" />
              </button>
            </div>
            <Link
              href="/login"
              className="btn-primary rounded-lg px-3 py-2 text-sm font-medium sm:px-4"
            >
              Sign in
            </Link>
            <MobileMenu
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              onOpenPalette={() => setPaletteOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenShortcuts={() => setShortcutsOpen(true)}
            />
          </div>
        </div>
      </header>

      <main
        onContextMenu={handleContextMenu}
        className={clsx(
          "relative w-full flex-1 px-6 py-6 transition-opacity duration-500 lg:px-10",
          focusMode && "pointer-events-none opacity-0",
        )}
      >
        <CollabCursorOverlay />
        <div key={activeTab} className="animate-slide-up">
          {activeTab === "overview" ? (
            <>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                    {"// workspace"}
                  </p>
                  <div className="mt-1.5">
                    <WorkspaceSwitcher onManage={() => setWorkspaceOpen(true)} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your daily developer dashboard. Everything below is mocked
                    locally — no backend required.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomizeOpen(true)}
                    data-sound="swoosh"
                    className="btn-surface flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    <Settings className="size-4 opacity-70" />
                    Customize
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomizeOpen(true)}
                    data-sound="swoosh"
                    className="btn-primary flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    <Plus className="size-4" />
                    Add widget
                  </button>
                </div>
              </div>

              {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
                  <Sparkles className="size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No widgets yet. Add some to build your workspace.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCustomizeOpen(true)}
                    className="btn-primary flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    <Plus className="size-4" />
                    Add widget
                  </button>
                </div>
              ) : (
                <WidgetGrid
                  widgets={visible}
                  onExpand={(id) => setExpandedId(id)}
                />
              )}

              <footer className="mt-10 flex items-center justify-between border-t border-border pt-6 text-sm text-muted-foreground">
                <span>DevDesk — frontend preview with local mock data.</span>
                <span className="hidden items-center gap-1.5 sm:flex">
                  Press
                  <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium">
                    ⌘K
                  </kbd>
                  for commands · keys
                  <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium">
                    1–4
                  </kbd>
                  jump to widgets
                </span>
              </footer>
            </>
          ) : activeTab === "widgets" ? (
            <WidgetsView onPreview={(id) => setExpandedId(id)} />
          ) : (
            <IntegrationsView />
          )}
        </div>
      </main>

      <div
        className={clsx(
          "transition-opacity duration-500",
          focusMode && "pointer-events-none opacity-0",
        )}
      >
        <StatusBar onOpenShortcuts={() => setShortcutsOpen(true)} />
      </div>

      <div
        className={clsx(
          "transition-opacity duration-500",
          focusMode && "pointer-events-none opacity-0",
        )}
      >
        <FloatingActionBar
          onOpenSearch={() => setPaletteOpen(true)}
          onNavigate={setActiveTab}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((value) => !value)}
        />
      </div>

      <FocusOverlay
        open={focusMode}
        onExit={() => setFocusMode(false)}
      />

      <ContextMenu
        position={menuPosition}
        items={contextItems}
        onClose={closeMenu}
      />

      <CustomizePanel
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
      />
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenThemeBuilder={() => {
          setSettingsOpen(false);
          setThemeBuilderOpen(true);
        }}
        onRestartTour={restartTour}
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={setActiveTab}
        onOpenCustomize={() => setCustomizeOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenWorkspace={() => setWorkspaceOpen(true)}
        onOpenThemeBuilder={() => setThemeBuilderOpen(true)}
        onOpenTour={() => setTourOpen(true)}
        onOpenNetworkLog={() => setNetworkOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onConnectIntegration={openIntegration}
      />
      <ThemeBuilderModal
        open={themeBuilderOpen}
        onClose={() => setThemeBuilderOpen(false)}
      />
      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <OnboardingTour
        open={tourOpen}
        onClose={finishTour}
        onNavigate={setActiveTab}
      />
      <WorkspaceManagerModal
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
      />
      <RequestLoggerDrawer
        open={networkOpen}
        onClose={() => setNetworkOpen(false)}
      />
      <WorkspaceAnalyticsModal
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
      />
      <Modal
        open={expanded !== null}
        onClose={() => setExpandedId(null)}
        title={expanded?.title ?? ""}
        size="xl"
      >
        {ExpandedComponent ? <ExpandedComponent /> : null}
      </Modal>

      <LofiMiniPlayer />
    </div>
  );
}
