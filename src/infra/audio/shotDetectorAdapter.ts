import { createOnsetState, muteBeep, processFrame, type OnsetConfig, type OnsetState } from '../../domain/audio/onset.ts';
import { ok, type Result } from '../../domain/result.ts';

export type DetectorHandles = {
  stop: () => void;
  level: () => number;
  mute: (muteMs: number) => void;
};

export type WorkletAudioContext = {
  audioWorklet?: { addModule(url: string): Promise<void> };
  sampleRate: number;
  createMediaStreamSource(stream: MediaStream): { connect(node: unknown): void };
  createAnalyser(): AnalyserNodeLike;
};

export type AnalyserNodeLike = {
  fftSize: number;
  getByteTimeDomainData(data: Uint8Array): void;
};

export type WorkletNodeLike = {
  port: {
    onmessage: ((ev: MessageEvent) => void) | null;
    postMessage(data: unknown): void;
  };
  connect(src: unknown): void;
  disconnect(): void;
};

export type DetectorHost = {
  requestAnimationFrame(fn: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
};

export async function startShotDetection(options: {
  context: WorkletAudioContext;
  stream: MediaStream;
  workletUrl: string;
  config: OnsetConfig;
  onShot: () => void;
  onLevel?: (rms: number) => void;
  nowMs: () => number;
  host?: DetectorHost;
  createWorkletNode?: (ctx: WorkletAudioContext) => WorkletNodeLike;
}): Promise<Result<DetectorHandles>> {
  const host = options.host ?? globalThis;
  if (options.context.audioWorklet && options.createWorkletNode) {
    try {
      await options.context.audioWorklet.addModule(options.workletUrl);
      const node = options.createWorkletNode(options.context);
      const source = options.context.createMediaStreamSource(options.stream);
      source.connect(node);
      node.port.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; energy?: number } | undefined;
        if (data?.type === 'shot') {
          options.onShot();
        } else if (data?.type === 'level') {
          options.onLevel?.(data.energy ?? 0);
        }
      };
      return ok({
        stop: () => {
          node.disconnect();
        },
        level: () => 0,
        mute: (muteMs) => {
          node.port.postMessage({ type: 'mute', ms: muteMs });
        },
      });
    } catch {
      return startAnalyserFallback(options, host);
    }
  }
  return startAnalyserFallback(options, host);
}

function startAnalyserFallback(
  options: {
    context: WorkletAudioContext;
    stream: MediaStream;
    config: OnsetConfig;
    onShot: () => void;
    onLevel?: (rms: number) => void;
    nowMs: () => number;
  },
  host: DetectorHost,
): Result<DetectorHandles> {
  const analyser = options.context.createAnalyser();
  analyser.fftSize = 2048;
  const source = options.context.createMediaStreamSource(options.stream);
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let state: OnsetState = createOnsetState();
  let raf = 0;
  let lastEnergy = 0;
  let running = true;

  const loop = () => {
    if (!running) {
      return;
    }
    analyser.getByteTimeDomainData(data);
    const samples = new Float32Array(data.length);
    for (let i = 0; i < data.length; i += 1) {
      samples[i] = ((data[i] as number) - 128) / 128;
    }
    const processed = processFrame(state, samples, options.context.sampleRate, options.nowMs(), options.config);
    state = processed.state;
    lastEnergy = processed.result.energy;
    options.onLevel?.(lastEnergy);
    if (processed.result.shot) {
      options.onShot();
    }
    raf = host.requestAnimationFrame(loop);
  };
  raf = host.requestAnimationFrame(loop);
  return ok({
    stop: () => {
      running = false;
      host.cancelAnimationFrame(raf);
    },
    level: () => lastEnergy,
    mute: (muteMs: number) => {
      state = muteBeep(state, options.nowMs(), muteMs);
    },
  });
}
