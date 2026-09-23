import type { TimeSec } from '../../domain/value-objects/ids.ts';
import type { ShotInputPort } from '../../ports/contracts.ts';

export class NoShotInput implements ShotInputPort {
  start(): void {
    return undefined;
  }

  stop(): void {
    return undefined;
  }

  mute(_ms: number): void {
    return undefined;
  }

  subscribe(_listener: (at: TimeSec) => void): () => void {
    return () => undefined;
  }
}

export class ManualShotInput implements ShotInputPort {
  private listener: ((at: TimeSec) => void) | undefined;

  start(): void {
    return undefined;
  }

  stop(): void {
    this.listener = undefined;
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
