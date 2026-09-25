import { CUE_BEEP_SEC, START_SIGNAL_SEC } from '../../domain/audio/startSignal.ts';

type OscillatorLike = {
  connect(node: GainLike): void;
  frequency: { value: number };
  type: OscillatorType;
  start(when: number): void;
  stop(when: number): void;
};

type GainLike = {
  connect(destination: unknown): void;
  gain: {
    setValueAtTime(value: number, when: number): void;
    exponentialRampToValueAtTime(value: number, when: number): void;
  };
};

export type BeepContext = {
  currentTime: number;
  destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
};

/** CED / AMG-style start signal: piercing square, hard gate, ~½ s. */
export const SHOT_TIMER_BEEP_HZ = 4000;
export const SHOT_TIMER_BEEP_BODY_HZ = 2000;
export const SHOT_TIMER_BEEP_SEC = START_SIGNAL_SEC;
export const FACE_CUE_HZ = 2400;
export const EDGE_CUE_HZ = 480;
export type TargetCue = 'face' | 'edge';
const RELEASE_SEC = 0.02;

function startTone(ctx: BeepContext, frequency: number, volume: number, now: number, durationSec: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const peak = Math.max(0.0001, volume);
  const releaseAt = now + durationSec - Math.min(RELEASE_SEC, durationSec / 2);
  const end = now + durationSec;
  osc.type = 'square';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(peak, now);
  gain.gain.setValueAtTime(peak, releaseAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(end);
}

export function playBeep(ctx: BeepContext, volume: number, now = ctx.currentTime): void {
  const clamped = Math.min(1, Math.max(0, volume));
  startTone(ctx, SHOT_TIMER_BEEP_HZ, clamped * 0.72, now, SHOT_TIMER_BEEP_SEC);
  startTone(ctx, SHOT_TIMER_BEEP_BODY_HZ, clamped * 0.28, now, SHOT_TIMER_BEEP_SEC);
}

export function playCue(ctx: BeepContext, volume: number, cue: TargetCue, now = ctx.currentTime): void {
  const clamped = Math.min(1, Math.max(0, volume));
  startTone(ctx, cue === 'face' ? FACE_CUE_HZ : EDGE_CUE_HZ, clamped, now, CUE_BEEP_SEC);
}
