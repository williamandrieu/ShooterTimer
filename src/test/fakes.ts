import { timeSec, type TimeSec } from '../domain/value-objects/ids.ts';
import type {
  ClockPort,
  IdPort,
  Logger,
  RandomPort,
  RunEffects,
  SessionRepository,
  SettingsRepository,
  ShotInputPort,
} from '../ports/contracts.ts';
import type { Session } from '../domain/session/session.ts';
import { ok, type Result } from '../domain/result.ts';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings/settings.ts';

export class FakeClock implements ClockPort {
  nowMs = 0;
  private nextId = 1;
  private readonly timers = new Map<
    number,
    { at: number; fn: () => void; interval?: number }
  >();

  now(): TimeSec {
    return timeSec(this.nowMs / 1000);
  }

  wallMs(): number {
    return this.nowMs;
  }

  setTimeout(fn: () => void, ms: number): number {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { at: this.nowMs + ms, fn });
    return id;
  }

  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  setInterval(fn: () => void, ms: number): number {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { at: this.nowMs + ms, fn, interval: ms });
    return id;
  }

  clearInterval(id: number): void {
    this.timers.delete(id);
  }

  advance(ms: number): void {
    const target = this.nowMs + ms;
    let guard = 0;
    while (guard < 10000) {
      guard += 1;
      let next: { id: number; at: number; fn: () => void; interval?: number } | undefined;
      for (const [id, timer] of this.timers) {
        if (timer.at <= target && (!next || timer.at < next.at)) {
          next = { id, at: timer.at, fn: timer.fn, interval: timer.interval };
        }
      }
      if (!next) {
        this.nowMs = target;
        return;
      }
      this.nowMs = next.at;
      if (next.interval !== undefined) {
        this.timers.set(next.id, { at: next.at + next.interval, fn: next.fn, interval: next.interval });
      } else {
        this.timers.delete(next.id);
      }
      next.fn();
    }
  }
}

export class SeededRandom implements RandomPort {
  constructor(private seed: number) {}

  next(): number {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  between(min: number, max: number): number {
    if (max <= min) {
      return min;
    }
    return min + this.next() * (max - min);
  }
}

export class SequentialIds implements IdPort {
  private n = 0;
  next(): string {
    this.n += 1;
    return `id-${this.n}`;
  }
}

export class CaptureLogger implements Logger {
  readonly lines: { level: string; message: string; extra?: unknown }[] = [];
  debug(message: string, extra?: unknown): void {
    this.lines.push({ level: 'debug', message, extra });
  }
  warn(message: string, extra?: unknown): void {
    this.lines.push({ level: 'warn', message, extra });
  }
  error(message: string, extra?: unknown): void {
    this.lines.push({ level: 'error', message, extra });
  }
}

export class MemorySessions implements SessionRepository {
  private readonly map = new Map<string, Session>();
  fail = false;

  async save(session: Session): Promise<Result<void>> {
    this.map.set(session.id, session);
    return ok(undefined);
  }
  async get(id: string): Promise<Result<Session | null>> {
    return ok(this.map.get(id) ?? null);
  }
  async list(): Promise<Result<Session[]>> {
    return ok([...this.map.values()]);
  }
  async delete(id: string): Promise<Result<void>> {
    this.map.delete(id);
    return ok(undefined);
  }
}

export class MemorySettings implements SettingsRepository {
  value: Settings = DEFAULT_SETTINGS;
  async load(): Promise<Settings> {
    return this.value;
  }
  async save(settings: Settings): Promise<Result<void>> {
    this.value = settings;
    return ok(undefined);
  }
}

export class RecordingEffects implements RunEffects {
  beeps = 0;
  flashes = 0;
  vibrates = 0;
  locks = 0;
  unlocks = 0;
  failLock = false;

  playBeep(): void {
    this.beeps += 1;
  }
  flash(): void {
    this.flashes += 1;
  }
  vibrate(): void {
    this.vibrates += 1;
  }
  async acquireWakeLock(): Promise<void> {
    if (this.failLock) {
      throw new Error('lock');
    }
    this.locks += 1;
  }
  async releaseWakeLock(): Promise<void> {
    this.unlocks += 1;
  }
}

export class ScriptedShotInput implements ShotInputPort {
  private listener: ((at: TimeSec) => void) | undefined;
  started = false;
  failStart = false;
  stopCount = 0;
  holdStart: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.failStart) {
      throw new Error('mic');
    }
    if (this.holdStart) {
      await this.holdStart;
    }
    this.started = true;
  }

  stop(): void {
    this.stopCount += 1;
    this.started = false;
  }

  mute(_ms: number): void {
    return undefined;
  }

  subscribe(listener: (at: TimeSec) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  emit(at: TimeSec): void {
    this.listener?.(at);
  }
}
