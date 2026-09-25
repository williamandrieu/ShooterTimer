import type { Result } from '../domain/result.ts';
import type { MicPermissionState, Settings } from '../domain/settings/settings.ts';
import type { Session } from '../domain/session/session.ts';
import type { TimeSec } from '../domain/value-objects/ids.ts';

export interface ClockPort {
  now(): TimeSec;
  wallMs(): number;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
}

export interface RandomPort {
  next(): number;
  between(min: number, max: number): number;
}

export interface IdPort {
  next(): string;
}

export interface Logger {
  debug(message: string, extra?: unknown): void;
  warn(message: string, extra?: unknown): void;
  error(message: string, extra?: unknown): void;
}

export interface ShotInputPort {
  start(): Promise<void> | void;
  stop(): void;
  subscribe(listener: (at: TimeSec) => void): () => void;
  mute(ms: number): void;
}

export interface WakeLockPort {
  acquire(): Promise<void>;
  release(): Promise<void>;
}

export type TargetCue = 'face' | 'edge';

export interface AudioOutputPort {
  resume(): Promise<void>;
  playBeep(volume: number): void;
  playCue(volume: number, cue: TargetCue): void;
  currentTime(): number;
  dispose(): void;
}

export interface RunEffects {
  playBeep(volume: number): void;
  playCue(volume: number, cue: TargetCue): void;
  flash(): void;
  vibrate(): void;
  acquireWakeLock(): Promise<void>;
  releaseWakeLock(): Promise<void>;
}

export interface TargetSequencePort {
  targetCount(): number;
  assignShotToTarget(shotOrdinal: number): number;
}

export interface SessionRepository {
  save(session: Session): Promise<Result<void>>;
  get(id: string): Promise<Result<Session | null>>;
  list(): Promise<Result<Session[]>>;
  delete(id: string): Promise<Result<void>>;
}

export interface SettingsRepository {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<Result<void>>;
}

export interface SpeechPort {
  speak(text: string, lang: string): void;
}

export interface MicPermissionPort {
  query(): Promise<MicPermissionState>;
}

export function requirePort<T>(port: T | undefined, name: string): T {
  if (port === undefined) {
    throw new Error(`Missing port: ${name}`);
  }
  return port;
}
