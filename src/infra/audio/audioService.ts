import type { OnsetConfig } from '../../domain/audio/onset.ts';
import { AppErrorCode, appError } from '../../domain/errors.ts';
import { err, ok, type Result } from '../../domain/result.ts';
import type { TimeSec } from '../../domain/value-objects/ids.ts';
import type { RunEffects, ShotInputPort, WakeLockPort } from '../../ports/contracts.ts';
import { playBeep, type BeepContext } from './beep.ts';
import { requestMicStream } from './micConstraints.ts';
import { startShotDetection, type DetectorHandles } from './shotDetectorAdapter.ts';
import { acquireWakeLock, releaseWakeLock, startSilentKeepAlive, type WakeLockSentinelLike } from './wakeLock.ts';

export type AudioContextCtor = new () => AudioContext;

type AudioWindow = typeof globalThis & {
  AudioContext?: AudioContextCtor;
  webkitAudioContext?: AudioContextCtor;
};

export class BrowserAudioService {
  private context: AudioContext | undefined;
  private keepAlive: (() => void) | undefined;
  lastLevel = 0;
  private readonly Context: AudioContextCtor | undefined;

  constructor(Context?: AudioContextCtor) {
    this.Context = Context;
  }

  private audioCtor(): AudioContextCtor | undefined {
    const host = globalThis as AudioWindow;
    return this.Context ?? host.AudioContext ?? host.webkitAudioContext;
  }

  unlock(): void {
    try {
      const Ctor = this.audioCtor();
      if (!Ctor) {
        return;
      }
      if (!this.context) {
        this.context = new Ctor();
      }
      if (this.context.state === 'suspended') {
        void this.context.resume();
      }
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.context.destination);
      osc.start();
      osc.stop(this.context.currentTime + 0.05);
    } catch {
      return;
    }
  }

  async resume(): Promise<void> {
    await this.ensure();
  }

  async ensure(): Promise<Result<AudioContext>> {
    this.unlock();
    try {
      if (!this.context) {
        return err(appError(AppErrorCode.AUDIO_CONTEXT_FAILED, 'Audio context failed'));
      }
      if (this.context.state !== 'running') {
        await this.context.resume();
      }
      if (this.context.state !== 'running') {
        await this.context.resume();
      }
      if (!this.keepAlive && this.context.state === 'running') {
        try {
          this.keepAlive = startSilentKeepAlive(this.context);
        } catch {
          this.keepAlive = undefined;
        }
      }
      return ok(this.context);
    } catch (cause) {
      return err(appError(AppErrorCode.AUDIO_CONTEXT_FAILED, 'Audio context failed', cause));
    }
  }

  playBeep(volume: number): void {
    if (!this.context) {
      return;
    }
    playBeep(this.context as unknown as BeepContext, volume);
  }

  currentTime(): number {
    return this.context?.currentTime ?? 0;
  }

  dispose(): void {
    this.keepAlive?.();
    this.keepAlive = undefined;
    void this.context?.close();
    this.context = undefined;
  }
}

export class BrowserWakeLock implements WakeLockPort {
  private sentinel: WakeLockSentinelLike | null = null;

  async acquire(): Promise<void> {
    this.sentinel = await acquireWakeLock();
  }

  async release(): Promise<void> {
    await releaseWakeLock(this.sentinel);
    this.sentinel = null;
  }
}

export class BrowserRunEffects implements RunEffects {
  private readonly audio: BrowserAudioService;
  private readonly wake: WakeLockPort;
  private readonly onFlash: () => void;

  constructor(audio: BrowserAudioService, wake: WakeLockPort, onFlash: () => void) {
    this.audio = audio;
    this.wake = wake;
    this.onFlash = onFlash;
  }

  playBeep(volume: number): void {
    this.audio.playBeep(volume);
  }

  flash(): void {
    this.onFlash();
  }

  vibrate(): void {
    navigator.vibrate?.(80);
  }

  async acquireWakeLock(): Promise<void> {
    await this.wake.acquire();
  }

  async releaseWakeLock(): Promise<void> {
    await this.wake.release();
  }
}

export class LiveShotInput implements ShotInputPort {
  private handles: DetectorHandles | undefined;
  private stream: MediaStream | undefined;
  private listener: ((at: TimeSec) => void) | undefined;
  private workletUrl: string;
  private readonly audio: BrowserAudioService;
  private readonly now: () => TimeSec;
  private readonly getUserMediaFn: typeof navigator.mediaDevices.getUserMedia;
  private readonly onset: OnsetConfig;

  constructor(
    audio: BrowserAudioService,
    now: () => TimeSec,
    workletUrl: string,
    onset: OnsetConfig,
    getUserMediaFn: typeof navigator.mediaDevices.getUserMedia = (...args) =>
      navigator.mediaDevices.getUserMedia(...args),
  ) {
    this.audio = audio;
    this.now = now;
    this.workletUrl = workletUrl;
    this.getUserMediaFn = getUserMediaFn;
    this.onset = onset;
  }

  async start(): Promise<void> {
    this.stop();
    this.audio.unlock();
    try {
      this.stream = await requestMicStream(this.getUserMediaFn);
      const ctx = await this.audio.ensure();
      if (!ctx.ok) {
        throw new Error(ctx.error.message);
      }
      const config: OnsetConfig = this.onset;
      const started = await startShotDetection({
        context: ctx.value,
        stream: this.stream,
        workletUrl: this.workletUrl,
        config,
        onShot: () => this.listener?.(this.now()),
        onLevel: (rms) => {
          this.audio.lastLevel = rms;
        },
        nowMs: () => this.now() * 1000,
      });
      if (!started.ok) {
        throw new Error(started.error.message);
      }
      this.handles = started.value;
    } catch (cause) {
      this.stop();
      throw cause;
    }
  }

  stop(): void {
    this.handles?.stop();
    this.handles = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }

  subscribe(listener: (at: TimeSec) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  mute(ms: number): void {
    this.handles?.mute(ms);
  }
}

export async function requestMicPermission(
  getUserMediaFn: typeof navigator.mediaDevices.getUserMedia = (...args) =>
    navigator.mediaDevices.getUserMedia(...args),
): Promise<Result<MediaStream>> {
  try {
    const stream = await requestMicStream(getUserMediaFn);
    return ok(stream);
  } catch (cause) {
    return err(appError(AppErrorCode.MIC_DENIED, 'Microphone permission denied', cause));
  }
}
