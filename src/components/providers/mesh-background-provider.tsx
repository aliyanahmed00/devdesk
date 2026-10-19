"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import {
  DEFAULT_MESH_BACKGROUND,
  MESH_BACKGROUND_STORAGE_KEY,
  normalizeMeshBackground,
  type MeshBackgroundConfig,
} from "@/lib/mesh-background";
import { MeshBackground } from "@/components/ui/mesh-background";
import { useLocalStorage } from "@/lib/use-local-storage";

type MeshBackgroundContextValue = {
  config: MeshBackgroundConfig;
  setConfig: (next: MeshBackgroundConfig) => void;
  updateConfig: (patch: Partial<MeshBackgroundConfig>) => void;
  resetConfig: () => void;
  toggleEnabled: () => void;
};

const MeshBackgroundContext = createContext<MeshBackgroundContextValue | null>(
  null,
);

export function MeshBackgroundProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<MeshBackgroundConfig>(
    MESH_BACKGROUND_STORAGE_KEY,
    DEFAULT_MESH_BACKGROUND,
  );
  const config = useMemo(() => normalizeMeshBackground(stored), [stored]);

  const updateConfig = useCallback(
    (patch: Partial<MeshBackgroundConfig>) => {
      setStored((current) =>
        normalizeMeshBackground({
          ...normalizeMeshBackground(current),
          ...patch,
        }),
      );
    },
    [setStored],
  );

  const resetConfig = useCallback(
    () => setStored(DEFAULT_MESH_BACKGROUND),
    [setStored],
  );

  const toggleEnabled = useCallback(
    () => updateConfig({ enabled: !config.enabled }),
    [updateConfig, config.enabled],
  );

  const value = useMemo<MeshBackgroundContextValue>(
    () => ({
      config,
      setConfig: setStored,
      updateConfig,
      resetConfig,
      toggleEnabled,
    }),
    [config, setStored, updateConfig, resetConfig, toggleEnabled],
  );

  return (
    <MeshBackgroundContext value={value}>
      <MeshBackground config={config} />
      {children}
    </MeshBackgroundContext>
  );
}

export function useMeshBackground() {
  const context = useContext(MeshBackgroundContext);
  if (!context) {
    throw new Error(
      "useMeshBackground must be used within a MeshBackgroundProvider",
    );
  }
  return context;
}
