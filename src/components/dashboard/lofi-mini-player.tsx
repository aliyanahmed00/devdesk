"use client";

import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { clsx } from "clsx";

import { useLofi } from "@/components/providers/lofi-provider";
import { AudioVisualizer } from "@/components/ui/audio-visualizer";
import { STATION_ICON, STATIONS } from "@/lib/lofi";

export function LofiMiniPlayer() {
  const {
    settings,
    playing,
    engaged,
    analyserRef,
    togglePlay,
    nextStation,
    prevStation,
    toggleMute,
    dismiss,
  } = useLofi();

  if (!engaged) return null;

  const station = STATIONS.find((item) => item.id === settings.station) ?? STATIONS[0];
  const Icon = STATION_ICON[station.id];

  return (
    <div className="animate-slide-up fixed bottom-4 left-1/2 z-40 w-[min(92vw,30rem)] -translate-x-1/2">
      <div className="glass flex items-center gap-3 rounded-full border border-border/70 py-2 pl-3 pr-2 shadow-2xl">
        <span
          className={clsx(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            playing
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium text-foreground">
            {station.label}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {playing ? "Now playing" : "Paused"} · {station.short}
          </p>
        </div>

        <AudioVisualizer
          analyserRef={analyserRef}
          active={playing}
          barCount={16}
          className={clsx(
            "hidden h-7 w-20 shrink-0 sm:block",
            playing ? "text-primary" : "text-muted-foreground/40",
          )}
        />

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={prevStation}
            aria-label="Previous station"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SkipBack className="size-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={nextStation}
            aria-label="Next station"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SkipForward className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={settings.muted ? "Unmute" : "Mute"}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {settings.muted ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close mini player"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
