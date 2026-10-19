"use client";

import { useEffect, useRef } from "react";

export type WidgetAction =
  | "notes:new"
  | "pomodoro:toggle"
  | "pomodoro:reset"
  | "pomodoro:start"
  | "task:add"
  | "snippet:new"
  | "lofi:toggle";

const ACTION_EVENT = "devdesk:widget-action";

export function emitWidgetAction(action: WidgetAction) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<WidgetAction>(ACTION_EVENT, { detail: action }),
  );
}

export function useWidgetAction(action: WidgetAction, handler: () => void) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = (event: Event) => {
      if ((event as CustomEvent<WidgetAction>).detail === action) {
        handlerRef.current();
      }
    };
    window.addEventListener(ACTION_EVENT, listener);
    return () => window.removeEventListener(ACTION_EVENT, listener);
  }, [action]);
}

const HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-primary",
  "ring-offset-2",
  "ring-offset-background",
];

export function focusWidget(id: string) {
  if (typeof window === "undefined") return;
  const element = document.getElementById(`widget-${id}`);
  if (!element) return;

  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.classList.add(...HIGHLIGHT_CLASSES);
  window.setTimeout(() => {
    element.classList.remove(...HIGHLIGHT_CLASSES);
  }, 1200);
}
