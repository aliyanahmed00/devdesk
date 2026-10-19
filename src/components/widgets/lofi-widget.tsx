"use client";

import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react";
import { clsx } from "clsx";

import { useLofi } from "@/components/providers/lofi-provider";
import { AudioVisualizer } from "@/components/ui/audio-visualizer";
import { STATION_ICON, STATIONS } from "@/lib/lofi";

export function LofiWidget() {
  const {
    settings,
    playing,
    activeCount,
    effectiveMaster,
    analyserRef,
    togglePlay,
    nextStation,
    prevStation,
    toggleChannel,
    setChannelVolume,
    setMaster,
    toggleMute,
  } = useLofi();

  const station =
    STATIONS.find((item) => item.id === settings.station) ?? STATIONS[0];
  const StationIcon = STATION_ICON[station.id];

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <StationIcon className="size-4" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-foreground">
              {station.label}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <span
                className={clsx(
                  "size-1.5 rounded-full",
                  playing ? "animate-pulse bg-emerald-400" : "bg-muted-foreground/50",
                )}
              />
              {playing
                ? activeCount > 1
                  ? `${activeCount} layers · playing`
                  : "Now playing"
                : "Paused"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={prevStation}
            aria-label="Previous station"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SkipBack className="size-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause ambient sound" : "Play ambient sound"}
            className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button
            type="button"
            onClick={nextStation}
            aria-label="Next station"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SkipForward className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 h-16 overflow-hidden rounded-lg border border-border/50 bg-background/40">
        <AudioVisualizer
          analyserRef={analyserRef}
          active={playing}
          barCount={44}
          className={clsx(
            "h-full w-full",
            playing ? "text-primary" : "text-primary/25",
          )}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={settings.muted ? "Unmute all" : "Mute all"}
          className={clsx(
            "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
            settings.muted
              ? "border-rose-500/50 bg-rose-500/10 text-rose-400"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {settings.muted ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.master}
          onChange={(event) => setMaster(Number(event.target.value))}
          aria-label="Master volume"
          className="range-touch flex-1"
        />
        <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {Math.round(effectiveMaster * 100)}%
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 font-mono text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
        <SlidersHorizontal className="size-3" />
        Channel mixer · tap to layer
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {STATIONS.map((item) => {
          const Icon = STATION_ICON[item.id];
          const state = settings.channels[item.id];
          const isFeatured = settings.station === item.id;
          return (
            <div
              key={item.id}
              className={clsx(
                "rounded-lg border p-2.5 transition-colors",
                state.on
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 bg-transparent",
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleChannel(item.id)}
                  aria-pressed={state.on}
                  className={clsx(
                    "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    state.on
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="flex items-center gap-1.5 truncate text-xs font-medium text-foreground">
                    {item.label}
                    {isFeatured && (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-primary uppercase">
                        live
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleChannel(item.id)}
                  aria-pressed={state.on}
                  aria-label={`${state.on ? "Mute" : "Unmute"} ${item.label}`}
                  className={clsx(
                    "flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                    state.on
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {state.on ? (
                    <Volume2 className="size-4" />
                  ) : (
                    <VolumeX className="size-4" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.volume}
                  onChange={(event) =>
                    setChannelVolume(item.id, Number(event.target.value))
                  }
                  aria-label={`${item.label} volume`}
                  className="range-touch flex-1"
                />
                <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(state.volume * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
