import { describe, expect, it } from 'vitest';
import {
  ONSET_PRESETS,
  DRY_FIRE_ONSET,
  createOnsetState,
  muteBeep,
  onsetConfigFor,
  processFrame,
  processFrames,
  sensitivityGates,
} from './onset.ts';
import { START_SIGNAL_MUTE_MS, START_SIGNAL_SEC } from './startSignal.ts';

function silence(n = 128): Float32Array {
  return new Float32Array(n);
}

function impulse(n = 128): Float32Array {
  const data = new Float32Array(n);
  data[0] = 1;
  data[1] = -1;
  data[2] = 0.8;
  return data;
}

describe('onset detector', () => {
  it('detects an impulse, ignores refractory, echo, mute and quiet noise', () => {
    const config = ONSET_PRESETS.handgun;
    let state = createOnsetState();
    for (let i = 0; i < 20; i += 1) {
      const result = processFrame(state, silence(960), 48000, i * 20, config);
      state = result.state;
      expect(result.result.shot).toBe(false);
    }
    const hit = processFrame(state, impulse(128), 48000, 500, config);
    expect(hit.result.shot).toBe(true);
    state = hit.state;
    const refractory = processFrame(state, impulse(128), 48000, 520, config);
    expect(refractory.result.shot).toBe(false);
    state = refractory.state;
    const echo = processFrame(state, new Float32Array(128).map((_, i) => (i === 0 ? 0.2 : 0)), 48000, 650, config);
    expect(echo.result.shot).toBe(false);
    state = muteBeep(echo.state, 800, 80);
    const muted = processFrame(state, impulse(128), 48000, 810, config);
    expect(muted.result.shot).toBe(false);
    let cooled = muted.state;
    for (let i = 0; i < 10; i += 1) {
      cooled = processFrame(cooled, silence(128), 48000, 900 + i * 20, config).state;
    }
    const later = processFrame(cooled, impulse(128), 48000, 2000, config);
    expect(later.result.shot).toBe(true);
  });

  it('processes frame lists including empty slots and even noise windows', () => {
    const config = { ...ONSET_PRESETS.indoor, noiseWindow: 2 };
    const frames: Float32Array[] = [silence(), silence(), impulse()];
    frames[1] = undefined as unknown as Float32Array;
    const processed = processFrames(createOnsetState(), frames, 48000, 0, 10, config);
    expect(processed.shotsAtMs.length).toBeGreaterThanOrEqual(0);
    expect(processFrames(createOnsetState(), [], 48000, 0, 10, config).shotsAtMs).toEqual([]);
    const quiet = processFrame(createOnsetState(), silence(4), 48000, 0, ONSET_PRESETS.rimfire);
    expect(quiet.result.energy).toBeGreaterThanOrEqual(0);
    const outdoor = processFrame(createOnsetState(), impulse(960), 48000, 0, ONSET_PRESETS.outdoor);
    expect(outdoor.result.energy).toBeGreaterThan(0);
  });

  it('detects a weak dry-fire click that live handgun ignores', () => {
    const weak = new Float32Array(128);
    weak[0] = 0.18;
    weak[1] = -0.14;
    function primed(config: (typeof ONSET_PRESETS)['handgun']) {
      let state = createOnsetState();
      for (let i = 0; i < 24; i += 1) {
        state = processFrame(state, silence(960), 48000, i * 20, config).state;
      }
      return processFrame(state, weak, 48000, 500, config);
    }
    expect(primed(DRY_FIRE_ONSET).result.shot).toBe(true);
    expect(primed(ONSET_PRESETS.handgun).result.shot).toBe(false);
    expect(onsetConfigFor('live', 'indoor', 0.4).sensitivity).toBe(0.4);
    expect(onsetConfigFor('dryTap', 'handgun', 0.1).sensitivity).toBe(0.1);
    expect(onsetConfigFor('dryTap', 'handgun', 0.1).refractoryMs).toBe(DRY_FIRE_ONSET.refractoryMs);
    expect(onsetConfigFor('dryPar', 'outdoor', 0.9).sensitivity).toBe(0.9);
    expect(sensitivityGates(1).attackThreshold).toBeLessThan(sensitivityGates(0).attackThreshold);
    expect(sensitivityGates(-1).energyGain).toBe(sensitivityGates(0).energyGain);
    expect(sensitivityGates(2).energyGain).toBe(sensitivityGates(1).energyGain);
    expect(START_SIGNAL_MUTE_MS).toBeGreaterThan(START_SIGNAL_SEC * 1000);
  });
});
