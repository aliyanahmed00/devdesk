"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function customEventName(key: string) {
  return `local-storage:${key}`;
}

function subscribe(key: string, callback: () => void) {
  const set = listeners.get(key) ?? new Set<() => void>();
  set.add(callback);
  listeners.set(key, set);

  const onStorage = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  const onCustom = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener(customEventName(key), onCustom);

  return () => {
    set.delete(callback);
    if (set.size === 0) listeners.delete(key);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(customEventName(key), onCustom);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota); ignore.
  }
  window.dispatchEvent(new Event(customEventName(key)));
}

export function notifyStorage(key: string) {
  window.dispatchEvent(new Event(customEventName(key)));
}

export function writeStorageRaw(key: string, value: string) {
  writeRaw(key, value);
}

export function removeStorageRaw(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode, quota); ignore.
  }
  notifyStorage(key);
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [initial] = useState(initialValue);

  const subscribeKey = useCallback(
    (callback: () => void) => subscribe(key, callback),
    [key],
  );
  const getSnapshot = useCallback(() => readRaw(key), [key]);
  const getServerSnapshot = useCallback(() => null, []);

  const raw = useSyncExternalStore(
    subscribeKey,
    getSnapshot,
    getServerSnapshot,
  );

  const value = useMemo<T>(() => {
    if (raw === null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  }, [raw, initial]);

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const currentRaw = readRaw(key);
      let current: T = initial;
      if (currentRaw !== null) {
        try {
          current = JSON.parse(currentRaw) as T;
        } catch {
          current = initial;
        }
      }
      const resolved =
        typeof next === "function"
          ? (next as (previous: T) => T)(current)
          : next;
      writeRaw(key, JSON.stringify(resolved));
    },
    [key, initial],
  );

  return [value, setValue] as const;
}
