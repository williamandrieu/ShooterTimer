export type WakeLockSentinelLike = {
  released: boolean;
  release(): Promise<void>;
};

export type WakeLockNavigator = {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

export async function acquireWakeLock(
  nav: WakeLockNavigator = navigator as WakeLockNavigator,
): Promise<WakeLockSentinelLike | null> {
  if (!nav.wakeLock) {
    return null;
  }
  try {
    return await nav.wakeLock.request('screen');
  } catch {
    return null;
  }
}

export async function releaseWakeLock(sentinel: WakeLockSentinelLike | null): Promise<void> {
  if (!sentinel || sentinel.released) {
    return;
  }
  await sentinel.release();
}

export type SilentKeepAliveContext = {
  createBuffer(channels: number, length: number, sampleRate: number): {
    getChannelData(channel: number): Float32Array;
  };
  createBufferSource(): {
    buffer: unknown;
    loop: boolean;
    connect(destination: unknown): void;
    start(): void;
    stop(): void;
  };
  sampleRate: number;
  destination: unknown;
};

export function startSilentKeepAlive(ctx: SilentKeepAliveContext): () => void {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  buffer.getChannelData(0).fill(0);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(ctx.destination);
  try {
    source.start();
  } catch {
    return () => undefined;
  }
  return () => {
    source.stop();
  };
}
