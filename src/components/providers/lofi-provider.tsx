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
  type RefObject,
} from "react";

import { useLocalStorage } from "@/lib/use-local-storage";
import { useWidgetAction } from "@/lib/widget-actions";
import {
  buildChannel,
  clamp01,
  effectiveMaster,
  normalizeLofi,
  STATION_IDS,
  type LofiSettings,
  type StationId,
} from "@/lib/lofi";

export const LOFI_STORAGE_KEY = "devdesk:lofi";

type LofiContextValue = {
  settings: LofiSettings;
  playing: boolean;
  engaged: boolean;
  activeCount: number;
  effectiveMaster: number;
  analyserRef: RefObject<AnalyserNode | null>;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  dismiss: () => void;
  nextStation: () => void;
  prevStation: () => void;
  setStation: (id: StationId) => void;
  toggleChannel: (id: StationId) => void;
  setChannelVolume: (id: StationId, volume: number) => void;
  setMaster: (volume: number) => void;
  toggleMute: () => void;
};

const LofiContext = createContext<LofiContextValue | null>(null);

function ramp(
  ctx: AudioContext,
  param: AudioParam,
  target: number,
  seconds: number,
) {
  const now = ctx.currentTime;
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
  } else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
  }
  param.linearRampToValueAtTime(target, now + seconds);
}

export function LofiProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<LofiSettings | null>(
    LOFI_STORAGE_KEY,
    null,
  );
  const settings = useMemo(() => normalizeLofi(stored), [stored]);

  const [playing, setPlaying] = useState(false);
  const [engaged, setEngaged] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const gateRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const channelsRef = useRef<Partial<Record<StationId, GainNode>>>({});
  const cleanupsRef = useRef<Array<() => void>>([]);
  const settingsRef = useRef(settings);
  const playingRef = useRef(false);
  const suspendTimer = useRef<number | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const ensureGraph = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    const gate = ctx.createGain();
    gate.gain.value = 0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;
    gate.connect(analyser);
    analyser.connect(ctx.destination);

    ctxRef.current = ctx;
    gateRef.current = gate;
    analyserRef.current = analyser;

    const current = settingsRef.current;
    for (const id of STATION_IDS) {
      const channel = ctx.createGain();
      channel.gain.value = current.channels[id].on
        ? current.channels[id].volume
        : 0;
      channel.connect(gate);
      channelsRef.current[id] = channel;
      cleanupsRef.current.push(buildChannel(ctx, id, channel));
    }

    return ctx;
  }, []);

  const play = useCallback(() => {
    const ctx = ensureGraph();
    if (ctx) void ctx.resume();
    setEngaged(true);
    setPlaying(true);
  }, [ensureGraph]);

  const pause = useCallback(() => setPlaying(false), []);

  const dismiss = useCallback(() => {
    setPlaying(false);
    setEngaged(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [play, pause]);

  useWidgetAction("lofi:toggle", togglePlay);

  useEffect(() => {
    if (!playing) {
      const ctx = ctxRef.current;
      const gate = gateRef.current;
      if (ctx && gate) {
        ramp(ctx, gate.gain, 0, 0.4);
        if (suspendTimer.current) window.clearTimeout(suspendTimer.current);
        suspendTimer.current = window.setTimeout(() => {
          if (!playingRef.current && ctxRef.current) {
            void ctxRef.current.suspend();
          }
        }, 480);
      }
      return;
    }

    const ctx = ensureGraph();
    if (!ctx) {
      window.setTimeout(() => setPlaying(false), 0);
      return;
    }
    if (suspendTimer.current) {
      window.clearTimeout(suspendTimer.current);
      suspendTimer.current = null;
    }
    void ctx.resume().then(() => {
      const gate = gateRef.current;
      if (gate) ramp(ctx, gate.gain, effectiveMaster(settingsRef.current), 0.7);
    });
  }, [playing, ensureGraph]);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    for (const id of STATION_IDS) {
      const channel = channelsRef.current[id];
      if (!channel) continue;
      const state = settings.channels[id];
      ramp(ctx, channel.gain, state.on ? state.volume : 0, 0.25);
    }
    if (playingRef.current && gateRef.current) {
      ramp(ctx, gateRef.current.gain, effectiveMaster(settings), 0.25);
    }
  }, [settings]);

  useEffect(
    () => () => {
      if (suspendTimer.current) window.clearTimeout(suspendTimer.current);
      cleanupsRef.current.forEach((cleanup) => cleanup());
      cleanupsRef.current = [];
      channelsRef.current = {};
      const ctx = ctxRef.current;
      ctxRef.current = null;
      gateRef.current = null;
      analyserRef.current = null;
      if (ctx) void ctx.close();
    },
    [],
  );

  const setStation = useCallback(
    (id: StationId) => {
      setStored((previous) => ({ ...normalizeLofi(previous), station: id }));
    },
    [setStored],
  );

  const stepStation = useCallback(
    (delta: number) => {
      setStored((previous) => {
        const base = normalizeLofi(previous);
        const index = STATION_IDS.indexOf(base.station);
        const next =
          STATION_IDS[
            (index + delta + STATION_IDS.length) % STATION_IDS.length
          ];
        return {
          ...base,
          station: next,
          channels: {
            ...base.channels,
            [next]: { ...base.channels[next], on: true },
          },
        };
      });
      play();
    },
    [setStored, play],
  );

  const nextStation = useCallback(() => stepStation(1), [stepStation]);
  const prevStation = useCallback(() => stepStation(-1), [stepStation]);

  const toggleChannel = useCallback(
    (id: StationId) => {
      setStored((previous) => {
        const base = normalizeLofi(previous);
        const on = !base.channels[id].on;
        return {
          ...base,
          station: on ? id : base.station,
          channels: {
            ...base.channels,
            [id]: { ...base.channels[id], on },
          },
        };
      });
    },
    [setStored],
  );

  const setChannelVolume = useCallback(
    (id: StationId, volume: number) => {
      const value = clamp01(volume);
      setStored((previous) => {
        const base = normalizeLofi(previous);
        return {
          ...base,
          channels: {
            ...base.channels,
            [id]: { ...base.channels[id], volume: value },
          },
        };
      });
    },
    [setStored],
  );

  const setMaster = useCallback(
    (volume: number) => {
      const value = clamp01(volume);
      setStored((previous) => ({
        ...normalizeLofi(previous),
        master: value,
        muted: false,
      }));
    },
    [setStored],
  );

  const toggleMute = useCallback(() => {
    setStored((previous) => {
      const base = normalizeLofi(previous);
      return { ...base, muted: !base.muted };
    });
  }, [setStored]);

  const activeCount = STATION_IDS.filter(
    (id) => settings.channels[id].on,
  ).length;

  const value = useMemo<LofiContextValue>(
    () => ({
      settings,
      playing,
      engaged,
      activeCount,
      effectiveMaster: effectiveMaster(settings),
      analyserRef,
      play,
      pause,
      togglePlay,
      dismiss,
      nextStation,
      prevStation,
      setStation,
      toggleChannel,
      setChannelVolume,
      setMaster,
      toggleMute,
    }),
    [
      settings,
      playing,
      engaged,
      activeCount,
      play,
      pause,
      togglePlay,
      dismiss,
      nextStation,
      prevStation,
      setStation,
      toggleChannel,
      setChannelVolume,
      setMaster,
      toggleMute,
    ],
  );

  return <LofiContext value={value}>{children}</LofiContext>;
}

export function useLofi() {
  const context = useContext(LofiContext);
  if (!context) {
    throw new Error("useLofi must be used within a LofiProvider");
  }
  return context;
}
