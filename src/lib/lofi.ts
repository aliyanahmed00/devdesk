import {
  CloudRain,
  Coffee,
  Disc3,
  Music2,
  Waves,
  type LucideIcon,
} from "lucide-react";

export type StationId = "lofi" | "synthwave" | "rain" | "cafe" | "white";

export type ChannelState = {
  on: boolean;
  volume: number;
};

export type LofiSettings = {
  master: number;
  muted: boolean;
  station: StationId;
  channels: Record<StationId, ChannelState>;
};

export type StationKind = "music" | "ambient" | "noise";

export type Station = {
  id: StationId;
  label: string;
  short: string;
  description: string;
  kind: StationKind;
};

export const STATIONS: Station[] = [
  {
    id: "lofi",
    label: "Lofi Beats",
    short: "Lofi Beats",
    description: "Vinyl crackle over warm jazzy pads",
    kind: "music",
  },
  {
    id: "synthwave",
    label: "Synthwave Focus",
    short: "Synthwave",
    description: "Retro arpeggios and a neon bassline",
    kind: "music",
  },
  {
    id: "rain",
    label: "Rain & Thunder",
    short: "Rain",
    description: "Downpour with distant rumble",
    kind: "ambient",
  },
  {
    id: "cafe",
    label: "Coffee Shop",
    short: "Coffee Shop",
    description: "Murmur, clatter and rising steam",
    kind: "ambient",
  },
  {
    id: "white",
    label: "White Noise",
    short: "White Noise",
    description: "Broadband noise to mask distraction",
    kind: "noise",
  },
];

export const STATION_IDS: StationId[] = STATIONS.map((station) => station.id);

export const STATION_ICON: Record<StationId, LucideIcon> = {
  lofi: Music2,
  synthwave: Disc3,
  rain: CloudRain,
  cafe: Coffee,
  white: Waves,
};

export const DEFAULT_SETTINGS: LofiSettings = {
  master: 0.7,
  muted: false,
  station: "lofi",
  channels: {
    lofi: { on: true, volume: 0.7 },
    synthwave: { on: false, volume: 0.6 },
    rain: { on: false, volume: 0.6 },
    cafe: { on: false, volume: 0.5 },
    white: { on: false, volume: 0.35 },
  },
};

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function effectiveMaster(settings: LofiSettings) {
  return settings.muted ? 0 : settings.master;
}

export function isStationId(value: unknown): value is StationId {
  return STATION_IDS.includes(value as StationId);
}

export function normalizeLofi(raw: unknown): LofiSettings {
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawChannels =
    source.channels && typeof source.channels === "object"
      ? (source.channels as Record<string, { on?: unknown; volume?: unknown }>)
      : source.tracks && typeof source.tracks === "object"
        ? (source.tracks as Record<string, { on?: unknown; volume?: unknown }>)
        : {};
  const legacySound =
    typeof source.sound === "string" ? source.sound : undefined;
  const legacyVolume =
    typeof source.volume === "number" ? source.volume : undefined;
  const hasChannels = Object.keys(rawChannels).length > 0;

  const channels = {} as Record<StationId, ChannelState>;
  for (const id of STATION_IDS) {
    const channel = rawChannels[id];
    channels[id] = {
      on:
        typeof channel?.on === "boolean"
          ? channel.on
          : !hasChannels && legacySound === id,
      volume: clamp01(
        typeof channel?.volume === "number"
          ? channel.volume
          : DEFAULT_SETTINGS.channels[id].volume,
      ),
    };
  }

  const stationSource = source.station ?? source.preset;
  const master = clamp01(
    typeof source.master === "number"
      ? source.master
      : (legacyVolume ?? DEFAULT_SETTINGS.master),
  );

  return {
    master,
    muted: typeof source.muted === "boolean" ? source.muted : false,
    station: isStationId(stationSource)
      ? stationSource
      : DEFAULT_SETTINGS.station,
    channels,
  };
}

type NoiseColor = "white" | "pink" | "brown";

function createNoiseBuffer(ctx: AudioContext, color: NoiseColor) {
  const length = Math.floor(ctx.sampleRate * 4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (color === "white") {
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  } else if (color === "brown") {
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }

  return buffer;
}

function startNoise(
  ctx: AudioContext,
  color: NoiseColor,
  out: GainNode,
  options: {
    filter: BiquadFilterType;
    frequency: number;
    q: number;
    gain: number;
    lfoRate?: number;
    lfoDepth?: number;
  },
) {
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, color);
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = options.filter;
  filter.frequency.value = options.frequency;
  filter.Q.value = options.q;

  const gain = ctx.createGain();
  gain.gain.value = options.gain;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);

  let lfo: OscillatorNode | null = null;
  if (options.lfoRate) {
    lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = options.lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = options.gain * (options.lfoDepth ?? 0);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
  }

  source.start();

  return () => {
    try {
      source.stop();
    } catch {
      // already stopped
    }
    if (lfo) {
      try {
        lfo.stop();
      } catch {
        // already stopped
      }
    }
  };
}

function startPad(ctx: AudioContext, out: GainNode, notes: number[]) {
  const padGain = ctx.createGain();
  padGain.gain.value = 0.14;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = 1200;
  padGain.connect(padFilter);
  padFilter.connect(out);

  const stop: Array<() => void> = [];
  notes.forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.5 / notes.length;
    osc.connect(voiceGain);
    voiceGain.connect(padGain);

    const detune = ctx.createOscillator();
    detune.type = "sine";
    detune.frequency.value = 0.05 + index * 0.017;
    const detuneGain = ctx.createGain();
    detuneGain.gain.value = 4;
    detune.connect(detuneGain);
    detuneGain.connect(osc.detune);

    osc.start();
    detune.start();
    stop.push(() => {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
      try {
        detune.stop();
      } catch {
        // already stopped
      }
    });
  });

  return () => stop.forEach((fn) => fn());
}

function startArpeggio(ctx: AudioContext, out: GainNode) {
  const scale = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0];
  const cleanupPad = startPad(ctx, out, [146.83, 220.0, 293.66]);
  let step = 0;

  const tick = () => {
    if (ctx.state !== "running") return;
    const now = ctx.currentTime;
    const frequency = scale[step % scale.length];
    step += 1;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = frequency * 2;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.34);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.4);

    if (step % 4 === 0) {
      const bass = ctx.createOscillator();
      bass.type = "square";
      bass.frequency.value = frequency / 2;
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = "lowpass";
      bassFilter.frequency.value = 620;
      const bassGain = ctx.createGain();
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      bass.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(out);
      bass.start(now);
      bass.stop(now + 0.55);
    }
  };

  const interval = window.setInterval(tick, 220);

  return () => {
    window.clearInterval(interval);
    cleanupPad();
  };
}

export function buildChannel(
  ctx: AudioContext,
  id: StationId,
  out: GainNode,
): () => void {
  const cleanups: Array<() => void> = [];

  if (id === "rain") {
    cleanups.push(
      startNoise(ctx, "white", out, {
        filter: "lowpass",
        frequency: 1500,
        q: 0.5,
        gain: 0.5,
        lfoRate: 0.11,
        lfoDepth: 0.12,
      }),
    );
    const thunder = window.setInterval(() => {
      if (ctx.state !== "running") return;
      if (Math.random() > 0.4) return;
      const now = ctx.currentTime;
      const blast = ctx.createBufferSource();
      blast.buffer = createNoiseBuffer(ctx, "brown");
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 220;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.55, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
      blast.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(out);
      blast.start(now, Math.random() * 2);
      blast.stop(now + 2.8);
    }, 15000);
    cleanups.push(() => window.clearInterval(thunder));
  } else if (id === "cafe") {
    cleanups.push(
      startNoise(ctx, "brown", out, {
        filter: "lowpass",
        frequency: 850,
        q: 0.4,
        gain: 0.55,
        lfoRate: 0.13,
        lfoDepth: 0.2,
      }),
    );
    const clatter = window.setInterval(() => {
      if (ctx.state !== "running") return;
      if (Math.random() > 0.5) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(2200 + Math.random() * 1400, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.3);
    }, 2800);
    cleanups.push(() => window.clearInterval(clatter));
  } else if (id === "white") {
    cleanups.push(
      startNoise(ctx, "white", out, {
        filter: "highpass",
        frequency: 140,
        q: 0.5,
        gain: 0.5,
        lfoRate: 0.07,
        lfoDepth: 0.05,
      }),
    );
  } else if (id === "synthwave") {
    cleanups.push(startArpeggio(ctx, out));
  } else {
    cleanups.push(
      startNoise(ctx, "pink", out, {
        filter: "lowpass",
        frequency: 950,
        q: 0.5,
        gain: 0.24,
        lfoRate: 0.16,
        lfoDepth: 0.2,
      }),
    );
    cleanups.push(startPad(ctx, out, [146.83, 220.0, 261.63, 329.63]));

    const crackle = ctx.createBufferSource();
    crackle.buffer = createNoiseBuffer(ctx, "white");
    crackle.loop = true;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 4200;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.012;
    crackle.connect(highpass);
    highpass.connect(crackleGain);
    crackleGain.connect(out);
    crackle.start();
    cleanups.push(() => {
      try {
        crackle.stop();
      } catch {
        // already stopped
      }
    });
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}
