"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useLocalStorage } from "@/lib/use-local-storage";
import {
  buildActivity,
  COLLAB_STORAGE_KEY,
  createSeedActivities,
  DEFAULT_COLLAB_SETTINGS,
  normalizeCollabSettings,
  TEAM,
  type CollabActivity,
  type CollabSettings,
  type Teammate,
} from "@/lib/collab-presence";

type CollabPresenceValue = {
  team: Teammate[];
  settings: CollabSettings;
  activities: CollabActivity[];
  setCursorsEnabled: (enabled: boolean) => void;
  toggleCursors: () => void;
};

const CollabPresenceContext = createContext<CollabPresenceValue | null>(null);

const ACTIVITY_INTERVAL_MS = 9000;
const MAX_ACTIVITIES = 40;

export function CollabPresenceProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<CollabSettings>(
    COLLAB_STORAGE_KEY,
    DEFAULT_COLLAB_SETTINGS,
  );
  const settings = useMemo(() => normalizeCollabSettings(stored), [stored]);

  const [activities, setActivities] = useState<CollabActivity[]>([]);
  const cursor = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(
      () => setActivities(createSeedActivities()),
      0,
    );
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const index = cursor.current;
      cursor.current += 1;
      setActivities((prev) =>
        [buildActivity(index), ...prev].slice(0, MAX_ACTIVITIES),
      );
    }, ACTIVITY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const setCursorsEnabled = useCallback(
    (enabled: boolean) =>
      setStored((current) => ({
        ...normalizeCollabSettings(current),
        cursorsEnabled: enabled,
      })),
    [setStored],
  );

  const toggleCursors = useCallback(
    () =>
      setStored((current) => {
        const next = normalizeCollabSettings(current);
        return { ...next, cursorsEnabled: !next.cursorsEnabled };
      }),
    [setStored],
  );

  const value = useMemo<CollabPresenceValue>(
    () => ({
      team: TEAM,
      settings,
      activities,
      setCursorsEnabled,
      toggleCursors,
    }),
    [settings, activities, setCursorsEnabled, toggleCursors],
  );

  return (
    <CollabPresenceContext value={value}>{children}</CollabPresenceContext>
  );
}

export function useCollabPresence() {
  const context = useContext(CollabPresenceContext);
  if (!context) {
    throw new Error(
      "useCollabPresence must be used within a CollabPresenceProvider",
    );
  }
  return context;
}
