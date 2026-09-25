import { describe, expect, it, vi } from 'vitest';
import {
  micAudioConstraints,
  micConstraints,
  relaxedMicAudioConstraints,
  requestMicStream,
} from './micConstraints.ts';
import {
  playBeep,
  playCue,
  EDGE_CUE_HZ,
  FACE_CUE_HZ,
  SHOT_TIMER_BEEP_BODY_HZ,
  SHOT_TIMER_BEEP_HZ,
  SHOT_TIMER_BEEP_SEC,
} from './beep.ts';
import { CUE_BEEP_SEC } from '../../domain/audio/startSignal.ts';
import { acquireWakeLock, releaseWakeLock, startSilentKeepAlive } from './wakeLock.ts';
import { startShotDetection } from './shotDetectorAdapter.ts';
import { handleWorkletQuantum, processWorkletInputs, createWorkletState } from './workletLogic.ts';
import { ONSET_PRESETS, createOnsetState, processFrame } from '../../domain/audio/onset.ts';
import { requestMicPermission } from './audioService.ts';
import { queryBrowserMicPermission } from './micPermission.ts';

describe('mic constraints', () => {
  it('disables processing', () => {
    expect(micConstraints().echoCancellation).toBe(false);
    expect(micAudioConstraints().video).toBe(false);
    expect(relaxedMicAudioConstraints()).toEqual({ audio: true, video: false });
  });

  it('falls back to relaxed constraints when the first request fails', async () => {
    const getUserMedia = vi
      .fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockRejectedValueOnce(new Error('overconstrained'))
      .mockResolvedValueOnce({ id: 's' } as unknown as MediaStream);
    await expect(requestMicStream(getUserMedia)).resolves.toEqual({ id: 's' });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia).toHaveBeenLastCalledWith(relaxedMicAudioConstraints());
  });
});

describe('beep', () => {
  it('plays a gated square shot-timer start signal', () => {
    const oscillators: Array<{
      frequency: { value: number };
      type: OscillatorType;
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];
    const ctx = {
      currentTime: 0,
      destination: {},
      createOscillator: () => {
        const osc = {
          frequency: { value: 0 },
          type: 'sine' as OscillatorType,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscillators.push(osc);
        return osc;
      },
      createGain: () => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }),
    };
    playBeep(ctx, 2);
    expect(oscillators).toHaveLength(2);
    expect(oscillators.map((osc) => osc.frequency.value).sort((a, b) => a - b)).toEqual([
      SHOT_TIMER_BEEP_BODY_HZ,
      SHOT_TIMER_BEEP_HZ,
    ]);
    expect(oscillators[0]?.type).toBe('square');
    expect(oscillators[0]?.stop).toHaveBeenCalledWith(SHOT_TIMER_BEEP_SEC);
    playBeep(ctx, -1, 1);
    expect(oscillators[2]?.start).toHaveBeenCalledWith(1);
    expect(oscillators[2]?.stop).toHaveBeenCalledWith(1 + SHOT_TIMER_BEEP_SEC);
    playCue(ctx, 0.5, 'face', 2);
    playCue(ctx, 0.5, 'edge', 3);
    expect(oscillators[4]?.frequency.value).toBe(FACE_CUE_HZ);
    expect(oscillators[4]?.stop).toHaveBeenCalledWith(2 + CUE_BEEP_SEC);
    expect(oscillators[5]?.frequency.value).toBe(EDGE_CUE_HZ);
    expect(oscillators[5]?.stop).toHaveBeenCalledWith(3 + CUE_BEEP_SEC);
  });
});

describe('wake lock', () => {
  it('handles missing API, failure, success and silent loop', async () => {
    expect(await acquireWakeLock({})).toBeNull();
    expect(await acquireWakeLock({ wakeLock: { request: async () => { throw new Error('no'); } } })).toBeNull();
    const sentinel = { released: false, release: vi.fn(async () => { sentinel.released = true; }) };
    expect(await acquireWakeLock({ wakeLock: { request: async () => sentinel } })).toBe(sentinel);
    await releaseWakeLock(null);
    await releaseWakeLock({ released: true, release: async () => undefined });
    await releaseWakeLock(sentinel);
    expect(sentinel.release).toHaveBeenCalled();
    const source = { buffer: null as unknown, loop: false, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const ctx = {
      sampleRate: 8,
      destination: {},
      createBuffer: () => ({ getChannelData: () => new Float32Array(8) }),
      createBufferSource: () => source,
    };
    const stop = startSilentKeepAlive(ctx);
    stop();
    expect(source.stop).toHaveBeenCalled();
    const failing = {
      sampleRate: 8,
      destination: {},
      createBuffer: () => ({ getChannelData: () => new Float32Array(8) }),
      createBufferSource: () => ({
        buffer: null as unknown,
        loop: false,
        connect: vi.fn(),
        start: () => {
          throw new Error('suspended');
        },
        stop: vi.fn(),
      }),
    };
    const noop = startSilentKeepAlive(failing);
    noop();
  });
});

describe('shot detector adapter', () => {
  it('uses worklet when available and falls back otherwise', async () => {
    const stream = {} as MediaStream;
    const node = {
      port: {
        onmessage: null as ((ev: MessageEvent) => void) | null,
        postMessage: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const workletCtx = {
      sampleRate: 48000,
      audioWorklet: { addModule: vi.fn(async () => undefined) },
      createMediaStreamSource: () => ({ connect: vi.fn() }),
      createAnalyser: () => ({ fftSize: 0, getByteTimeDomainData: vi.fn() }),
    };
    const started = await startShotDetection({
      context: workletCtx,
      stream,
      workletUrl: '/w.js',
      config: ONSET_PRESETS.handgun,
      onShot: vi.fn(),
      onLevel: vi.fn(),
      nowMs: () => 0,
      createWorkletNode: () => node,
    });
    expect(started.ok).toBe(true);
    node.port.onmessage?.({ data: { type: 'shot' } } as MessageEvent);
    node.port.onmessage?.({ data: { type: 'level', energy: 0.3 } } as MessageEvent);
    node.port.onmessage?.({ data: { type: 'level' } } as MessageEvent);
    node.port.onmessage?.({ data: { type: 'other' } } as MessageEvent);
    node.port.onmessage?.({ data: undefined } as MessageEvent);
    started.value.mute(10);
    expect(node.port.postMessage).toHaveBeenCalledWith({ type: 'mute', ms: 10 });
    expect(started.value.level()).toBe(0);
    started.value.stop();

    let failCalls = 0;
    workletCtx.audioWorklet.addModule = vi.fn(async () => {
      throw new Error('fail');
    });
    const fallbackFromFail = await startShotDetection({
      context: workletCtx,
      stream,
      workletUrl: '/w.js',
      config: ONSET_PRESETS.handgun,
      onShot: vi.fn(),
      nowMs: () => 0,
      createWorkletNode: () => node,
      host: {
        requestAnimationFrame: (fn) => {
          failCalls += 1;
          if (failCalls < 2) {
            fn(0);
          }
          return failCalls;
        },
        cancelAnimationFrame: vi.fn(),
      },
    });
    fallbackFromFail.value.stop();

    let calls = 0;
    const analyser = {
      fftSize: 0,
      getByteTimeDomainData: (data: Uint8Array) => {
        data.fill(255);
      },
    };
    const host = {
      requestAnimationFrame: (fn: FrameRequestCallback) => {
        calls += 1;
        if (calls < 3) {
          fn(0);
        }
        return calls;
      },
      cancelAnimationFrame: vi.fn(),
    };
    const fallback = await startShotDetection({
      context: {
        sampleRate: 48000,
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        createAnalyser: () => analyser,
      },
      stream,
      workletUrl: '/w.js',
      config: ONSET_PRESETS.handgun,
      onShot: vi.fn(),
      onLevel: vi.fn(),
      nowMs: () => 1000,
      host,
    });
    expect(fallback.ok).toBe(true);
    fallback.value.mute(20);
    fallback.value.level();
    fallback.value.stop();
    fallback.value.stop();

    let afterStop: FrameRequestCallback | undefined;
    const delayedHost = {
      requestAnimationFrame: (fn: FrameRequestCallback) => {
        afterStop = fn;
        return 9;
      },
      cancelAnimationFrame: vi.fn(),
    };
    const stopped = await startShotDetection({
      context: {
        sampleRate: 48000,
        audioWorklet: { addModule: vi.fn(async () => undefined) },
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        createAnalyser: () => ({
          fftSize: 0,
          getByteTimeDomainData: (data: Uint8Array) => data.fill(128),
        }),
      },
      stream,
      workletUrl: '/w.js',
      config: ONSET_PRESETS.handgun,
      onShot: vi.fn(),
      nowMs: () => 0,
      host: delayedHost,
    });
    stopped.value.stop();
    afterStop?.(0);

    const noHostFallback = await startShotDetection({
      context: {
        sampleRate: 48000,
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        createAnalyser: () => ({
          fftSize: 0,
          getByteTimeDomainData: vi.fn(),
        }),
      },
      stream,
      workletUrl: '/w.js',
      config: ONSET_PRESETS.handgun,
      onShot: vi.fn(),
      nowMs: () => 0,
      host: {
        requestAnimationFrame: () => 1,
        cancelAnimationFrame: vi.fn(),
      },
    });
    noHostFallback.value.stop();
    let sampleCalls = 0;
    const shootingAnalyser = {
      fftSize: 0,
      getByteTimeDomainData: (data: Uint8Array) => {
        sampleCalls += 1;
        data.fill(128);
        if (sampleCalls > 8) {
          data[0] = 255;
          data[1] = 0;
          data[2] = 255;
        }
      },
    };
    let shotCalls = 0;
    const shotHost = {
      requestAnimationFrame: (fn: FrameRequestCallback) => {
        shotCalls += 1;
        if (shotCalls < 12) {
          fn(0);
        }
        return shotCalls;
      },
      cancelAnimationFrame: vi.fn(),
    };
    const onShot = vi.fn();
    const shooting = await startShotDetection({
      context: {
        sampleRate: 48000,
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        createAnalyser: () => shootingAnalyser,
      },
      stream,
      workletUrl: '/w.js',
      config: ONSET_PRESETS.handgun,
      onShot,
      nowMs: () => sampleCalls * 40,
      host: shotHost,
    });
    expect(onShot).toHaveBeenCalled();
    shooting.value.stop();
  });
});

describe('worklet contract', () => {
  it('matches onset processFrame decisions', () => {
    const config = ONSET_PRESETS.handgun;
    const samples = new Float32Array(128);
    samples[0] = 1;
    const a = processFrame(createOnsetState(), samples, 48000, 500, config);
    const messages: unknown[] = [];
    handleWorkletQuantum(createOnsetState(), samples, 48000, 500, config, {
      postMessage: (data) => messages.push(data),
    });
    expect(a.result.shot).toBe((messages as { type: string }[]).some((m) => m.type === 'shot'));
    const empty = processWorkletInputs({ port: { postMessage: vi.fn() } }, createWorkletState(), [[]], 48000, 0);
    expect(empty.prevSample).toBe(0);
    processWorkletInputs(
      { port: { postMessage: vi.fn() } },
      createWorkletState(),
      [[samples]],
      48000,
      40,
    );
  });
});

describe('requestMicPermission', () => {
  it('wraps getUserMedia', async () => {
    const ok = await requestMicPermission(async () => ({ id: 's' }) as unknown as MediaStream);
    expect(ok.ok).toBe(true);
    const denied = await requestMicPermission(async () => {
      throw new Error('denied');
    });
    expect(denied.ok).toBe(false);
  });
});

describe('queryBrowserMicPermission', () => {
  it('reads the Permissions API and degrades when missing', async () => {
    expect(await queryBrowserMicPermission({ query: async () => ({ state: 'granted' }) })).toBe('granted');
    expect(await queryBrowserMicPermission({ query: async () => ({ state: 'denied' }) })).toBe('denied');
    expect(await queryBrowserMicPermission({ query: async () => ({ state: 'prompt' }) })).toBe('prompt');
    expect(await queryBrowserMicPermission({ query: async () => ({ state: 'maybe' }) })).toBe('unknown');
    expect(
      await queryBrowserMicPermission({
        query: async () => {
          throw new Error('unsupported');
        },
      }),
    ).toBe('unknown');
    expect(await queryBrowserMicPermission({} as { query: () => Promise<{ state: string }> })).toBe('unknown');
    const previous = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { permissions: { query: async () => ({ state: 'granted' }) } },
    });
    expect(await queryBrowserMicPermission()).toBe('granted');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined });
    expect(await queryBrowserMicPermission()).toBe('unknown');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previous });
  });
});
