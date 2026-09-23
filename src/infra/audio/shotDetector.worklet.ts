/// <reference types="vite/client" />
/* AudioWorkletProcessor is provided by the browser worklet scope. */
declare const sampleRate: number;
declare function registerProcessor(
  name: string,
  ctor: new () => { process(inputs: Float32Array[][]): boolean },
): void;
declare class AudioWorkletProcessor {
  port: { postMessage(data: unknown): void; onmessage: ((ev: MessageEvent) => void) | null };
}

const PRE_EMPHASIS = 0.97;

class ShotDetectorProcessor extends AudioWorkletProcessor {
  prevSample = 0;
  prevEnergy = 0;
  lastShotMs = -1e9;
  lastPeak = 0;
  mutedUntil = 0;
  nowMs = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'mute') {
        this.mutedUntil = this.nowMs + (event.data.ms ?? 80);
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) {
      return true;
    }
    this.nowMs += (channel.length / sampleRate) * 1000;
    let sum = 0;
    let prev = this.prevSample;
    for (let i = 0; i < channel.length; i += 1) {
      const sample = channel[i] ?? 0;
      const high = sample - PRE_EMPHASIS * prev;
      sum += high * high;
      prev = sample;
    }
    this.prevSample = prev;
    const energy = Math.sqrt(sum / channel.length);
    const delta = energy - this.prevEnergy;
    this.prevEnergy = energy;
    this.port.postMessage({ type: 'level', energy });
    const muted = this.nowMs < this.mutedUntil;
    const refractory = this.nowMs - this.lastShotMs < 120;
    const echo = this.nowMs - this.lastShotMs < 220 && energy < this.lastPeak * 0.5;
    if (!muted && !refractory && !echo && energy > 0.12 && delta > 0.04) {
      this.lastShotMs = this.nowMs;
      this.lastPeak = energy;
      this.port.postMessage({ type: 'shot', energy });
    }
    return true;
  }
}

registerProcessor('shot-detector', ShotDetectorProcessor);
