export type OnsetConfig = {
  sensitivity: number;
  refractoryMs: number;
  echoWindowMs: number;
  echoRatio: number;
  muteMs: number;
  noiseWindow: number;
};

export type MicPreset = 'indoor' | 'outdoor' | 'rimfire' | 'handgun';

export const DRY_FIRE_ONSET: OnsetConfig = {
  sensitivity: 0.88,
  refractoryMs: 80,
  echoWindowMs: 110,
  echoRatio: 0.3,
  muteMs: 80,
  noiseWindow: 80,
};

export function sensitivityGates(sensitivity: number): {
  energyGain: number;
  energyBias: number;
  attackThreshold: number;
} {
  const s = Math.min(1, Math.max(0, sensitivity));
  return {
    energyGain: 2.2 + (1 - s) * 14,
    energyBias: 0.012 + (1 - s) * 0.09,
    attackThreshold: 0.01 + (1 - s) * 0.1,
  };
}

export function onsetConfigFor(
  inputMethod: 'live' | 'dryPar' | 'dryTap' | 'dryParTap',
  micPreset: MicPreset,
  sensitivity: number,
): OnsetConfig {
  const base = inputMethod === 'live' ? ONSET_PRESETS[micPreset] : DRY_FIRE_ONSET;
  return { ...base, sensitivity };
}

export const ONSET_PRESETS: Record<MicPreset, OnsetConfig> = {
  indoor: {
    sensitivity: 0.45,
    refractoryMs: 130,
    echoWindowMs: 250,
    echoRatio: 0.55,
    muteMs: 80,
    noiseWindow: 48,
  },
  outdoor: {
    sensitivity: 0.55,
    refractoryMs: 110,
    echoWindowMs: 180,
    echoRatio: 0.4,
    muteMs: 80,
    noiseWindow: 48,
  },
  rimfire: {
    sensitivity: 0.72,
    refractoryMs: 100,
    echoWindowMs: 200,
    echoRatio: 0.5,
    muteMs: 80,
    noiseWindow: 48,
  },
  handgun: {
    sensitivity: 0.55,
    refractoryMs: 120,
    echoWindowMs: 220,
    echoRatio: 0.5,
    muteMs: 80,
    noiseWindow: 48,
  },
};

export type OnsetState = {
  prevSample: number;
  prevEnergy: number;
  noiseEnergies: number[];
  lastShotMs: number | null;
  lastPeakEnergy: number;
  mutedUntilMs: number;
};

export type FrameResult = {
  shot: boolean;
  energy: number;
  noiseFloor: number;
};

export function createOnsetState(): OnsetState {
  return {
    prevSample: 0,
    prevEnergy: 0,
    noiseEnergies: [],
    lastShotMs: null,
    lastPeakEnergy: 0,
    mutedUntilMs: 0,
  };
}

export function muteBeep(state: OnsetState, nowMs: number, muteMs: number): OnsetState {
  return { ...state, mutedUntilMs: Math.max(state.mutedUntilMs, nowMs + muteMs) };
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 1e-6;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const high = sorted[mid] as number;
  if (sorted.length % 2 === 1) {
    return high;
  }
  const low = sorted[mid - 1] as number;
  return (low + high) / 2;
}

function rmsHighPassed(samples: Float32Array, prevSample: number): { energy: number; lastSample: number } {
  let sum = 0;
  let prev = prevSample;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i] as number;
    const high = sample - 0.97 * prev;
    sum += high * high;
    prev = sample;
  }
  const n = Math.max(1, samples.length);
  return { energy: Math.sqrt(sum / n), lastSample: prev };
}

export function processFrame(
  state: OnsetState,
  samples: Float32Array,
  _sampleRate: number,
  nowMs: number,
  config: OnsetConfig,
): { state: OnsetState; result: FrameResult } {
  const { energy, lastSample } = rmsHighPassed(samples, state.prevSample);
  const delta = energy - state.prevEnergy;
  const quiet = energy < Math.max(state.prevEnergy * 1.4, 0.02);
  const noiseEnergies = quiet ? [...state.noiseEnergies, energy].slice(-config.noiseWindow) : state.noiseEnergies;
  const noiseFloor = median(noiseEnergies);
  const gates = sensitivityGates(config.sensitivity);
  const energyThreshold = noiseFloor * gates.energyGain + gates.energyBias;
  const attackThreshold = gates.attackThreshold;
  const muted = nowMs < state.mutedUntilMs;
  const refractory =
    state.lastShotMs !== null && nowMs - state.lastShotMs < config.refractoryMs;
  const isEcho =
    state.lastShotMs !== null &&
    nowMs - state.lastShotMs < config.echoWindowMs &&
    energy < state.lastPeakEnergy * config.echoRatio;
  const shot =
    !muted &&
    !refractory &&
    !isEcho &&
    energy > energyThreshold &&
    delta > attackThreshold;

  const next: OnsetState = {
    prevSample: lastSample,
    prevEnergy: energy,
    noiseEnergies,
    lastShotMs: shot ? nowMs : state.lastShotMs,
    lastPeakEnergy: shot ? energy : state.lastPeakEnergy,
    mutedUntilMs: state.mutedUntilMs,
  };

  return { state: next, result: { shot, energy, noiseFloor } };
}

export function processFrames(
  initial: OnsetState,
  frames: Float32Array[],
  sampleRate: number,
  startMs: number,
  hopMs: number,
  config: OnsetConfig,
): { state: OnsetState; shotsAtMs: number[] } {
  let current = initial;
  const shotsAtMs: number[] = [];
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (!frame) {
      continue;
    }
    const nowMs = startMs + i * hopMs;
    const processed = processFrame(current, frame, sampleRate, nowMs, config);
    current = processed.state;
    if (processed.result.shot) {
      shotsAtMs.push(nowMs);
    }
  }
  return { state: current, shotsAtMs };
}
