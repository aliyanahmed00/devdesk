"use client";

import {
  Command,
  Focus,
  LayoutDashboard,
  LayoutGrid,
  Plug,
  Plus,
  Settings,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";

export type HotkeyId =
  | "palette"
  | "customize"
  | "settings"
  | "focus"
  | "view-overview"
  | "view-widgets"
  | "view-integrations"
  | "pomodoro"
  | "close";

export type HotkeyCategory = "Navigation" | "Widgets & Cards" | "System & Theme";

export type HotkeyCombo = {
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type HotkeyDefinition = {
  id: HotkeyId;
  label: string;
  description: string;
  category: HotkeyCategory;
  icon: LucideIcon;
  defaultCombo: HotkeyCombo;
  /** Installed in the global window listener (modifier-based actions). */
  global: boolean;
  /** User can rebind and enable/disable this shortcut. */
  remappable: boolean;
};

export const HOTKEYS: HotkeyDefinition[] = [
  {
    id: "palette",
    label: "Command Palette",
    description: "Open universal search across every widget and action.",
    category: "Navigation",
    icon: Command,
    defaultCombo: { key: "k", meta: true },
    global: true,
    remappable: true,
  },
  {
    id: "view-overview",
    label: "Go to Overview",
    description: "Jump to the widget dashboard.",
    category: "Navigation",
    icon: LayoutDashboard,
    defaultCombo: { key: "1", meta: true },
    global: true,
    remappable: true,
  },
  {
    id: "view-widgets",
    label: "Go to Widget Gallery",
    description: "Browse and add available widgets.",
    category: "Navigation",
    icon: LayoutGrid,
    defaultCombo: { key: "2", meta: true },
    global: true,
    remappable: true,
  },
  {
    id: "view-integrations",
    label: "Go to Integrations",
    description: "Manage connected developer services.",
    category: "Navigation",
    icon: Plug,
    defaultCombo: { key: "3", meta: true },
    global: true,
    remappable: true,
  },
  {
    id: "pomodoro",
    label: "Toggle Pomodoro",
    description: "Start or pause the timer while a Pomodoro card is focused.",
    category: "Widgets & Cards",
    icon: Timer,
    defaultCombo: { key: " " },
    global: false,
    remappable: false,
  },
  {
    id: "customize",
    label: "Add / Customize Widgets",
    description: "Open the widget drawer to add, remove or reorder cards.",
    category: "System & Theme",
    icon: Plus,
    defaultCombo: { key: "a", meta: true, shift: true },
    global: true,
    remappable: true,
  },
  {
    id: "settings",
    label: "Open Settings",
    description: "Open the appearance and theme settings drawer.",
    category: "System & Theme",
    icon: Settings,
    defaultCombo: { key: "s", meta: true, shift: true },
    global: true,
    remappable: true,
  },
  {
    id: "focus",
    label: "Zenith Focus Mode",
    description:
      "Enter a distraction-free overlay with the timer, active task and scratchpad.",
    category: "System & Theme",
    icon: Focus,
    defaultCombo: { key: "f", meta: true, shift: true },
    global: true,
    remappable: true,
  },
  {
    id: "close",
    label: "Close Overlay",
    description: "Dismiss any open drawer, dialog, or the Command Palette.",
    category: "System & Theme",
    icon: X,
    defaultCombo: { key: "escape" },
    global: false,
    remappable: false,
  },
];

export const HOTKEY_CATEGORY_ORDER: HotkeyCategory[] = [
  "Navigation",
  "Widgets & Cards",
  "System & Theme",
];

export const HOTKEYS_STORAGE_KEY = "devdesk:hotkeys";

export type HotkeyPrefs = {
  enabled: Partial<Record<HotkeyId, boolean>>;
  combos: Partial<Record<HotkeyId, HotkeyCombo>>;
};

export function defaultHotkeyPrefs(): HotkeyPrefs {
  const enabled: Partial<Record<HotkeyId, boolean>> = {};
  const combos: Partial<Record<HotkeyId, HotkeyCombo>> = {};
  for (const def of HOTKEYS) {
    enabled[def.id] = true;
    if (def.global) combos[def.id] = def.defaultCombo;
  }
  return { enabled, combos };
}

export function getHotkey(id: HotkeyId): HotkeyDefinition | undefined {
  return HOTKEYS.find((def) => def.id === id);
}

export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

export function comboMatchesEvent(combo: HotkeyCombo, event: KeyboardEvent) {
  const meta = event.metaKey || event.ctrlKey;
  const metaOk = (combo.meta ?? false) === meta;
  const shiftOk = (combo.shift ?? false) === event.shiftKey;
  const altOk = (combo.alt ?? false) === event.altKey;
  const keyOk = normalizeKey(event.key) === combo.key;
  return metaOk && shiftOk && altOk && keyOk;
}

export function comboFromEvent(event: KeyboardEvent): HotkeyCombo {
  return {
    key: normalizeKey(event.key),
    meta: event.metaKey || event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  };
}

const MODIFIER_KEYS = new Set(["meta", "control", "shift", "alt"]);

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key.toLowerCase());
}

export function isValidCombo(combo: HotkeyCombo): boolean {
  if (!combo.key || isModifierKey(combo.key)) return false;
  return Boolean(combo.meta || combo.shift || combo.alt);
}

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  escape: "Esc",
  enter: "↵",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

export function keyLabel(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function comboToKeycaps(combo: HotkeyCombo, isMac: boolean): string[] {
  const caps: string[] = [];
  if (combo.meta) caps.push(isMac ? "⌘" : "Ctrl");
  if (combo.alt) caps.push(isMac ? "⌥" : "Alt");
  if (combo.shift) caps.push("Shift");
  caps.push(keyLabel(combo.key));
  return caps;
}

export function formatCombo(combo: HotkeyCombo, isMac: boolean): string {
  return comboToKeycaps(combo, isMac).join("+");
}

export function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}
