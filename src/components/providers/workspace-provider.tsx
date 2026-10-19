"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { useToast } from "@/components/providers/toast-provider";
import { useLocalStorage } from "@/lib/use-local-storage";
import {
  EMPTY_WORKSPACE_STORE,
  WORKSPACES_STORAGE_KEY,
  WORKSPACE_PRESETS,
  applyLiveData,
  buildExport,
  createId,
  downloadJson,
  parseImport,
  slugify,
  snapshotLiveData,
  type WorkspaceData,
  type WorkspaceProfile,
  type WorkspaceStore,
} from "@/lib/workspace";

type WorkspaceContextValue = {
  profiles: WorkspaceProfile[];
  activeId: string;
  activeProfile: WorkspaceProfile | null;
  switchTo: (id: string) => void;
  createProfile: (name: string, glyph?: string) => void;
  createFromPreset: (presetId: string) => void;
  duplicateProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  resetActiveLayout: () => void;
  exportActive: () => void;
  importWorkspace: (text: string) => boolean;
  readLiveData: () => WorkspaceData;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useLocalStorage<WorkspaceStore>(
    WORKSPACES_STORAGE_KEY,
    EMPTY_WORKSPACE_STORE,
  );
  const { toast } = useToast();

  const profiles = store.profiles;
  const activeId = store.activeId || profiles[0]?.id || "";
  const activeProfile =
    profiles.find((profile) => profile.id === activeId) ?? null;

  useEffect(() => {
    if (profiles.length > 0) return;
    const id = window.setTimeout(() => {
      const now = Date.now();
      const profile: WorkspaceProfile = {
        id: createId(),
        name: "Default",
        glyph: "🗂️",
        createdAt: now,
        updatedAt: now,
        data: snapshotLiveData(),
      };
      setStore((prev) =>
        prev.profiles.length > 0
          ? prev
          : { profiles: [profile], activeId: profile.id },
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, [profiles.length, setStore]);

  const readLiveData = useCallback(() => snapshotLiveData(), []);

  const switchTo = useCallback(
    (id: string) => {
      if (id === activeId) return;
      const live = snapshotLiveData();
      const now = Date.now();
      const nextProfiles = profiles.map((profile) =>
        profile.id === activeId
          ? { ...profile, data: live, updatedAt: now }
          : profile,
      );
      const target = nextProfiles.find((profile) => profile.id === id);
      if (!target) return;
      applyLiveData(target.data);
      setStore({ profiles: nextProfiles, activeId: id });
      toast(`Switched to ${target.name}`, "success");
    },
    [activeId, profiles, setStore, toast],
  );

  const createProfile = useCallback(
    (name: string, glyph = "🗂️") => {
      const live = snapshotLiveData();
      const now = Date.now();
      const profile: WorkspaceProfile = {
        id: createId(),
        name: name.trim() || "Untitled",
        glyph,
        createdAt: now,
        updatedAt: now,
        data: live,
      };
      setStore((prev) => ({
        profiles: [
          ...prev.profiles.map((item) =>
            item.id === prev.activeId
              ? { ...item, data: live, updatedAt: now }
              : item,
          ),
          profile,
        ],
        activeId: profile.id,
      }));
      toast(`Created “${profile.name}”`, "success");
    },
    [setStore, toast],
  );

  const createFromPreset = useCallback(
    (presetId: string) => {
      const preset = WORKSPACE_PRESETS.find((item) => item.id === presetId);
      if (!preset) return;
      const live = snapshotLiveData();
      const data: WorkspaceData = { ...live, "devdesk:widgets": preset.widgets };
      const now = Date.now();
      const profile: WorkspaceProfile = {
        id: createId(),
        name: preset.name,
        glyph: preset.glyph,
        createdAt: now,
        updatedAt: now,
        data,
      };
      setStore((prev) => ({
        profiles: [
          ...prev.profiles.map((item) =>
            item.id === prev.activeId
              ? { ...item, data: live, updatedAt: now }
              : item,
          ),
          profile,
        ],
        activeId: profile.id,
      }));
      applyLiveData(data);
      toast(`“${preset.name}” workspace ready`, "success");
    },
    [setStore, toast],
  );

  const duplicateProfile = useCallback(
    (id: string) => {
      const source = profiles.find((profile) => profile.id === id);
      if (!source) return;
      const live = id === activeId ? snapshotLiveData() : source.data;
      const now = Date.now();
      const copy: WorkspaceProfile = {
        id: createId(),
        name: `${source.name} copy`,
        glyph: source.glyph,
        createdAt: now,
        updatedAt: now,
        data: live,
      };
      setStore((prev) => ({
        profiles: [
          ...prev.profiles.map((item) =>
            item.id === prev.activeId
              ? { ...item, data: snapshotLiveData(), updatedAt: now }
              : item,
          ),
          copy,
        ],
        activeId: copy.id,
      }));
      applyLiveData(copy.data);
      toast(`Duplicated “${source.name}”`, "success");
    },
    [activeId, profiles, setStore, toast],
  );

  const renameProfile = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setStore((prev) => ({
        profiles: prev.profiles.map((profile) =>
          profile.id === id
            ? { ...profile, name: trimmed, updatedAt: Date.now() }
            : profile,
        ),
        activeId: prev.activeId,
      }));
    },
    [setStore],
  );

  const deleteProfile = useCallback(
    (id: string) => {
      if (profiles.length <= 1) {
        toast("Keep at least one workspace", "error");
        return;
      }
      const target = profiles.find((profile) => profile.id === id);
      if (id === activeId) {
        const fallback = profiles.find((profile) => profile.id !== id);
        if (!fallback) return;
        applyLiveData(fallback.data);
        setStore({
          profiles: profiles.filter((profile) => profile.id !== id),
          activeId: fallback.id,
        });
        toast(`Deleted “${target?.name}” · switched to ${fallback.name}`, "info");
      } else {
        setStore({
          profiles: profiles.filter((profile) => profile.id !== id),
          activeId,
        });
        toast(`Deleted “${target?.name}”`, "info");
      }
    },
    [activeId, profiles, setStore, toast],
  );

  const resetActiveLayout = useCallback(() => {
    applyLiveData({});
    setStore((prev) => ({
      profiles: prev.profiles.map((profile) =>
        profile.id === prev.activeId
          ? { ...profile, data: {}, updatedAt: Date.now() }
          : profile,
      ),
      activeId: prev.activeId,
    }));
    toast("Workspace restored to the default layout", "info");
  }, [setStore, toast]);

  const exportActive = useCallback(() => {
    const live = snapshotLiveData();
    const name = activeProfile?.name ?? "Workspace";
    const payload = buildExport({ name }, live);
    setStore((prev) => ({
      profiles: prev.profiles.map((profile) =>
        profile.id === prev.activeId
          ? { ...profile, data: live, updatedAt: Date.now() }
          : profile,
      ),
      activeId: prev.activeId,
    }));
    downloadJson(`${slugify(name)}.devdesk.json`, payload);
    toast(`Exported “${name}”`, "success");
  }, [activeProfile, setStore, toast]);

  const importWorkspace = useCallback(
    (text: string): boolean => {
      try {
        const { name, data } = parseImport(text);
        const now = Date.now();
        const profile: WorkspaceProfile = {
          id: createId(),
          name,
          glyph: "📥",
          createdAt: now,
          updatedAt: now,
          data,
        };
        setStore((prev) => ({
          profiles: [...prev.profiles, profile],
          activeId: profile.id,
        }));
        applyLiveData(data);
        toast(`Imported “${name}”`, "success");
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not import that file.";
        toast(message, "error");
        return false;
      }
    },
    [setStore, toast],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      profiles,
      activeId,
      activeProfile,
      switchTo,
      createProfile,
      createFromPreset,
      duplicateProfile,
      renameProfile,
      deleteProfile,
      resetActiveLayout,
      exportActive,
      importWorkspace,
      readLiveData,
    }),
    [
      profiles,
      activeId,
      activeProfile,
      switchTo,
      createProfile,
      createFromPreset,
      duplicateProfile,
      renameProfile,
      deleteProfile,
      resetActiveLayout,
      exportActive,
      importWorkspace,
      readLiveData,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
