"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import {
  DEFAULT_SOUND_EFFECTS_SETTINGS,
  isSoundEffectName,
  normalizeSoundEffectsSettings,
  playSoundEffect,
  SOUND_EFFECTS_STORAGE_KEY,
  type SoundEffectName,
  type SoundEffectsSettings,
} from "@/lib/sound-effects";
import { useLocalStorage } from "@/lib/use-local-storage";

type SoundEffectsContextValue = {
  settings: SoundEffectsSettings;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  /** Play a cue, respecting the global enabled flag + volume. */
  play: (name: SoundEffectName) => void;
  /** Play a cue for the settings preview, ignoring the enabled flag. */
  preview: (name: SoundEffectName) => void;
};

const SoundEffectsContext = createContext<SoundEffectsContextValue | null>(
  null,
);

const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [role="switch"], [role="tab"], input[type="checkbox"], input[type="radio"], summary';

function isDisabled(element: Element): boolean {
  if (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement
  ) {
    return element.disabled;
  }
  return element.getAttribute("aria-disabled") === "true";
}

/**
 * Decide which cue (if any) an interaction should emit. Elements may opt out
 * with `data-sound="off"` or pick a specific cue with `data-sound="swoosh"`.
 */
function resolveTrigger(target: EventTarget | null): SoundEffectName | null {
  if (!(target instanceof Element)) return null;
  const marker = target.closest("[data-sound]");
  if (marker instanceof HTMLElement) {
    const value = marker.dataset.sound;
    if (value === "off" || value === "none") return null;
    if (isSoundEffectName(value)) return value;
  }
  const interactive = target.closest(INTERACTIVE_SELECTOR);
  if (!interactive || isDisabled(interactive)) return null;
  return "click";
}

export function SoundEffectsProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<SoundEffectsSettings>(
    SOUND_EFFECTS_STORAGE_KEY,
    DEFAULT_SOUND_EFFECTS_SETTINGS,
  );
  const settings = useMemo(
    () => normalizeSoundEffectsSettings(stored),
    [stored],
  );

  const play = useCallback(
    (name: SoundEffectName) => {
      if (!settings.enabled) return;
      playSoundEffect(name, settings.volume);
    },
    [settings.enabled, settings.volume],
  );

  const preview = useCallback(
    (name: SoundEffectName) => {
      playSoundEffect(name, settings.volume);
    },
    [settings.volume],
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      setStored((current) => ({
        ...normalizeSoundEffectsSettings(current),
        enabled,
      }));
    },
    [setStored],
  );

  const setVolume = useCallback(
    (volume: number) => {
      setStored((current) => ({
        ...normalizeSoundEffectsSettings(current),
        volume,
      }));
    },
    [setStored],
  );

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const name = resolveTrigger(event.target);
      if (name) play(name);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key !== "Enter" &&
        event.key !== " " &&
        event.key !== "Spacebar"
      ) {
        return;
      }
      const name = resolveTrigger(event.target);
      if (name) play(name);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [play]);

  const value = useMemo<SoundEffectsContextValue>(
    () => ({ settings, setEnabled, setVolume, play, preview }),
    [settings, setEnabled, setVolume, play, preview],
  );

  return (
    <SoundEffectsContext.Provider value={value}>
      {children}
    </SoundEffectsContext.Provider>
  );
}

export function useSoundEffects(): SoundEffectsContextValue {
  const context = useContext(SoundEffectsContext);
  if (!context) {
    throw new Error("useSoundEffects must be used within a SoundEffectsProvider");
  }
  return context;
}
