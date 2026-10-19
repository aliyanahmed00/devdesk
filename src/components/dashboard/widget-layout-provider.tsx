"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";

import { useLocalStorage } from "@/lib/use-local-storage";

import type { WidgetId } from "./widget-registry";

export const WIDGET_STORAGE_KEY = "devdesk:widgets";

export const DEFAULT_WIDGETS: WidgetId[] = [
  "notes",
  "pomodoro",
  "task-board",
  "snippets",
];

type WidgetLayoutContextValue = {
  enabled: WidgetId[];
  isEnabled: (id: WidgetId) => boolean;
  toggle: (id: WidgetId) => void;
  enable: (id: WidgetId) => void;
  remove: (id: WidgetId) => void;
  reset: () => void;
  move: (from: number, to: number) => void;
  setLayout: (ids: WidgetId[]) => void;
};

const WidgetLayoutContext = createContext<WidgetLayoutContextValue | null>(null);

export function WidgetLayoutProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useLocalStorage<WidgetId[]>(
    WIDGET_STORAGE_KEY,
    DEFAULT_WIDGETS,
  );

  const isEnabled = useCallback(
    (id: WidgetId) => enabled.includes(id),
    [enabled],
  );

  const toggle = useCallback(
    (id: WidgetId) => {
      setEnabled((current) =>
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id],
      );
    },
    [setEnabled],
  );

  const remove = useCallback(
    (id: WidgetId) => {
      setEnabled((current) => current.filter((item) => item !== id));
    },
    [setEnabled],
  );

  const enable = useCallback(
    (id: WidgetId) => {
      setEnabled((current) =>
        current.includes(id) ? current : [...current, id],
      );
    },
    [setEnabled],
  );

  const move = useCallback(
    (from: number, to: number) => {
      setEnabled((current) => {
        if (
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= current.length ||
          to >= current.length
        ) {
          return current;
        }
        const next = [...current];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
    },
    [setEnabled],
  );

  const reset = useCallback(() => {
    setEnabled(DEFAULT_WIDGETS);
  }, [setEnabled]);

  const setLayout = useCallback(
    (ids: WidgetId[]) => {
      setEnabled(ids);
    },
    [setEnabled],
  );

  return (
    <WidgetLayoutContext
      value={{ enabled, isEnabled, toggle, enable, remove, reset, move, setLayout }}
    >
      {children}
    </WidgetLayoutContext>
  );
}

export function useWidgetLayout() {
  const context = useContext(WidgetLayoutContext);
  if (!context) {
    throw new Error(
      "useWidgetLayout must be used within a WidgetLayoutProvider",
    );
  }
  return context;
}
