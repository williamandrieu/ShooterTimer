import { ONSET_PRESETS, createOnsetState, processFrame, type OnsetConfig, type OnsetState } from '../../domain/audio/onset.ts';

type ProcessorScope = {
  port: { postMessage(data: unknown): void };
};

export function handleWorkletQuantum(
  state: OnsetState,
  samples: Float32Array,
  sampleRate: number,
  nowMs: number,
  config: OnsetConfig,
  port: { postMessage(data: unknown): void },
): OnsetState {
  const processed = processFrame(state, samples, sampleRate, nowMs, config);
  port.postMessage({ type: 'level', energy: processed.result.energy });
  if (processed.result.shot) {
    port.postMessage({ type: 'shot', energy: processed.result.energy });
  }
  return processed.state;
}

export function createWorkletState(): OnsetState {
  return createOnsetState();
}

export const WORKLET_DEFAULT_PRESET = ONSET_PRESETS.handgun;

export function processWorkletInputs(
  scope: ProcessorScope,
  state: OnsetState,
  inputs: Float32Array[][],
  sampleRate: number,
  nowMs: number,
  config: OnsetConfig = WORKLET_DEFAULT_PRESET,
): OnsetState {
  const channel = inputs[0]?.[0];
  if (!channel || channel.length === 0) {
    return state;
  }
  return handleWorkletQuantum(state, channel, sampleRate, nowMs, config, scope.port);
}
