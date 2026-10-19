export const SOUND_EFFECTS_STORAGE_KEY = "devdesk:sound-effects";

/** The procedural UI cues available in the global sound engine. */
export type SoundEffectName = "click" | "pop" | "chime" | "swoosh";

export const SOUND_EFFECT_NAMES: readonly SoundEffectName[] = [
  "click",
  "pop",
  "chime",
  "swoosh",
];

export const SOUND_EFFECT_LABELS: Record<SoundEffectName, string> = {
  click: "Click",
  pop: "Pop",
  chime: "Chime",
  swoosh: "Swoosh",
};

export const SOUND_EFFECT_DESCRIPTIONS: Record<SoundEffectName, string> = {
  click: "Subtle tactile tick on buttons",
  pop: "Crisp pop when a widget is dropped",
  chime: "Soft chime when a Pomodoro ends",
  swoosh: "Clean swoosh when a drawer toggles",
};

export type SoundEffectsSettings = {
  /** Master switch for all procedural UI sound effects. */
  enabled: boolean;
  /** Output level applied to every cue (0 – 1). */
  volume: number;
};

export const SOUND_VOLUME_RANGE = { min: 0, max: 1 } as const;

export const DEFAULT_SOUND_EFFECTS_SETTINGS: SoundEffectsSettings = {
  enabled: true,
  volume: 0.5,
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeSoundEffectsSettings(
  value: Partial<SoundEffectsSettings> | null | undefined,
): SoundEffectsSettings {
  const enabled =
    typeof value?.enabled === "boolean"
      ? value.enabled
      : DEFAULT_SOUND_EFFECTS_SETTINGS.enabled;
  const volume =
    typeof value?.volume === "number" && Number.isFinite(value.volume)
      ? clamp(value.volume, SOUND_VOLUME_RANGE.min, SOUND_VOLUME_RANGE.max)
      : DEFAULT_SOUND_EFFECTS_SETTINGS.volume;
  return { enabled, volume };
}

export function isSoundEffectName(value: unknown): value is SoundEffectName {
  return (
    typeof value === "string" &&
    (SOUND_EFFECT_NAMES as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/* Web Audio engine                                                           */
/* -------------------------------------------------------------------------- */

type AudioContextCtor = typeof AudioContext;

let sharedContext: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedContext) return sharedContext;
  const ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext;
  if (!ctor) return null;
  try {
    sharedContext = new ctor();
  } catch {
    sharedContext = null;
  }
  return sharedContext;
}

/** Resume the shared context from a user gesture so cues play immediately. */
export function primeAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = Math.max(1, Math.floor(ctx.sampleRate * 0.4));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

type ToneOptions = {
  type: OscillatorType;
  frequency: number;
  endFrequency?: number;
  start: number;
  attack: number;
  duration: number;
  peak: number;
};

function playTone(ctx: AudioContext, options: ToneOptions) {
  const { type, frequency, endFrequency, start, attack, duration, peak } =
    options;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      start + duration,
    );
  }
  const peakGain = Math.max(0.0001, peak);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playClick(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  playTone(ctx, {
    type: "triangle",
    frequency: 1850,
    start: now,
    attack: 0.001,
    duration: 0.03,
    peak: 0.22 * volume,
  });
}

function playPop(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  playTone(ctx, {
    type: "sine",
    frequency: 460,
    endFrequency: 150,
    start: now,
    attack: 0.004,
    duration: 0.09,
    peak: 0.5 * volume,
  });
}

function playChime(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  const notes = [659.25, 830.61, 987.77];
  notes.forEach((frequency, index) => {
    playTone(ctx, {
      type: "sine",
      frequency,
      start: now + index * 0.14,
      attack: 0.012,
      duration: 0.5,
      peak: 0.16 * volume,
    });
  });
}

function playSwoosh(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(320, now);
  filter.frequency.exponentialRampToValueAtTime(2600, now + 0.18);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, 0.22 * volume),
    now + 0.05,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
  source.stop(now + 0.26);
}

/**
 * Fire a procedural cue. `volume` is the master level (0 – 1); the engine is a
 * no-op on the server, when Web Audio is unavailable, or at zero volume.
 */
export function playSoundEffect(name: SoundEffectName, volume: number) {
  if (volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  const level = clamp(volume, SOUND_VOLUME_RANGE.min, SOUND_VOLUME_RANGE.max);
  try {
    switch (name) {
      case "click":
        playClick(ctx, level);
        break;
      case "pop":
        playPop(ctx, level);
        break;
      case "chime":
        playChime(ctx, level);
        break;
      case "swoosh":
        playSwoosh(ctx, level);
        break;
    }
  } catch {
    // Web Audio unavailable or interrupted; silently ignore.
  }
}
