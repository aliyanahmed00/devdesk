"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { useLocalStorage } from "@/lib/use-local-storage";
import {
  HOTKEYS,
  HOTKEYS_STORAGE_KEY,
  comboMatchesEvent,
  defaultHotkeyPrefs,
  type HotkeyCombo,
  type HotkeyId,
  type HotkeyPrefs,
} from "@/lib/hotkeys";

const DEFAULT_PREFS = defaultHotkeyPrefs();

function mergePrefs(partial: HotkeyPrefs | null | undefined): HotkeyPrefs {
  return {
    enabled: { ...DEFAULT_PREFS.enabled, ...(partial?.enabled ?? {}) },
    combos: { ...DEFAULT_PREFS.combos, ...(partial?.combos ?? {}) },
  };
}

type HotkeysContextValue = {
  prefs: HotkeyPrefs;
  isEnabled: (id: HotkeyId) => boolean;
  getCombo: (id: HotkeyId) => HotkeyCombo;
  setEnabled: (id: HotkeyId, value: boolean) => void;
  toggleEnabled: (id: HotkeyId) => void;
  setCombo: (id: HotkeyId, combo: HotkeyCombo) => void;
  reset: () => void;
};

const HotkeysContext = createContext<HotkeysContextValue | null>(null);

export function HotkeysProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<HotkeyPrefs>(
    HOTKEYS_STORAGE_KEY,
    DEFAULT_PREFS,
  );

  const prefs = useMemo(() => mergePrefs(stored), [stored]);

  const isEnabled = useCallback(
    (id: HotkeyId) => prefs.enabled[id] !== false,
    [prefs],
  );

  const getCombo = useCallback(
    (id: HotkeyId): HotkeyCombo => {
      const combo = prefs.combos[id];
      if (combo) return combo;
      return HOTKEYS.find((def) => def.id === id)?.defaultCombo ?? { key: "" };
    },
    [prefs],
  );

  const setEnabled = useCallback(
    (id: HotkeyId, value: boolean) => {
      setStored((previous) => {
        const merged = mergePrefs(previous);
        return { ...merged, enabled: { ...merged.enabled, [id]: value } };
      });
    },
    [setStored],
  );

  const toggleEnabled = useCallback(
    (id: HotkeyId) => {
      setStored((previous) => {
        const merged = mergePrefs(previous);
        const next = merged.enabled[id] === false;
        return { ...merged, enabled: { ...merged.enabled, [id]: next } };
      });
    },
    [setStored],
  );

  const setCombo = useCallback(
    (id: HotkeyId, combo: HotkeyCombo) => {
      setStored((previous) => {
        const merged = mergePrefs(previous);
        return { ...merged, combos: { ...merged.combos, [id]: combo } };
      });
    },
    [setStored],
  );

  const reset = useCallback(() => {
    setStored(DEFAULT_PREFS);
  }, [setStored]);

  const value = useMemo<HotkeysContextValue>(
    () => ({
      prefs,
      isEnabled,
      getCombo,
      setEnabled,
      toggleEnabled,
      setCombo,
      reset,
    }),
    [prefs, isEnabled, getCombo, setEnabled, toggleEnabled, setCombo, reset],
  );

  return (
    <HotkeysContext.Provider value={value}>{children}</HotkeysContext.Provider>
  );
}

export function useHotkeys(): HotkeysContextValue {
  const context = useContext(HotkeysContext);
  if (!context) {
    throw new Error("useHotkeys must be used within a HotkeysProvider");
  }
  return context;
}

export type HotkeyHandlers = Partial<Record<HotkeyId, () => void>>;

export function useGlobalHotkeys(
  handlers: HotkeyHandlers,
  onTrigger?: (id: HotkeyId) => void,
) {
  const { prefs } = useHotkeys();
  const handlersRef = useRef(handlers);
  const triggerRef = useRef(onTrigger);

  useEffect(() => {
    handlersRef.current = handlers;
    triggerRef.current = onTrigger;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;

      if (event.key === "Escape") {
        handlersRef.current.close?.();
        return;
      }

      const def = HOTKEYS.find(
        (candidate) =>
          candidate.global &&
          prefs.enabled[candidate.id] !== false &&
          comboMatchesEvent(
            prefs.combos[candidate.id] ?? candidate.defaultCombo,
            event,
          ),
      );
      if (!def) return;

      event.preventDefault();
      handlersRef.current[def.id]?.();
      triggerRef.current?.(def.id);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs]);
}
