"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  API_CONFIG_KEY,
  DEFAULT_API_CONFIG,
  clearRequestLog,
  getRequestLog,
  setApiConfig,
  subscribeRequestLog,
  type ApiConfig,
  type RequestLogEntry,
} from "@/lib/api-client";
import { useLocalStorage } from "@/lib/use-local-storage";

export const MOCK_API_CONFIG_KEY = API_CONFIG_KEY;

type MockApiContextValue = {
  config: ApiConfig;
  setConfig: (next: ApiConfig) => void;
  updateConfig: (patch: Partial<ApiConfig>) => void;
  resetConfig: () => void;
  offline: boolean;
  setOffline: (offline: boolean) => void;
  toggleOffline: () => void;
  log: RequestLogEntry[];
  clearLog: () => void;
};

const MockApiContext = createContext<MockApiContextValue | null>(null);

export function MockApiProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<ApiConfig>(
    API_CONFIG_KEY,
    DEFAULT_API_CONFIG,
  );

  const config = useMemo<ApiConfig>(
    () => ({ ...DEFAULT_API_CONFIG, ...stored }),
    [stored],
  );

  // Keep the module-level store (read by `mockRequest`) in sync.
  useEffect(() => {
    setApiConfig(config);
  }, [config]);

  const log = useSyncExternalStore(
    subscribeRequestLog,
    getRequestLog,
    getRequestLog,
  );

  const setConfig = useCallback(
    (next: ApiConfig) => setStored({ ...DEFAULT_API_CONFIG, ...next }),
    [setStored],
  );

  const updateConfig = useCallback(
    (patch: Partial<ApiConfig>) =>
      setStored((previous) => ({
        ...DEFAULT_API_CONFIG,
        ...previous,
        ...patch,
      })),
    [setStored],
  );

  const resetConfig = useCallback(
    () => setStored(DEFAULT_API_CONFIG),
    [setStored],
  );

  const setOffline = useCallback(
    (offline: boolean) => updateConfig({ offline }),
    [updateConfig],
  );

  const toggleOffline = useCallback(
    () => setStored((previous) => ({
      ...DEFAULT_API_CONFIG,
      ...previous,
      offline: !(previous.offline ?? false),
    })),
    [setStored],
  );

  const clearLog = useCallback(() => clearRequestLog(), []);

  const value = useMemo<MockApiContextValue>(
    () => ({
      config,
      setConfig,
      updateConfig,
      resetConfig,
      offline: config.offline,
      setOffline,
      toggleOffline,
      log,
      clearLog,
    }),
    [
      config,
      setConfig,
      updateConfig,
      resetConfig,
      setOffline,
      toggleOffline,
      log,
      clearLog,
    ],
  );

  return <MockApiContext value={value}>{children}</MockApiContext>;
}

export function useMockApi(): MockApiContextValue {
  const context = useContext(MockApiContext);
  if (!context) {
    throw new Error("useMockApi must be used within a MockApiProvider");
  }
  return context;
}
