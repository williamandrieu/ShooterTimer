import { timeSec, type TimeSec } from '../../value-objects/ids.ts';
import type { TimerEvent } from '../events.ts';
import type { TimerProfileId } from '../../drills/types.ts';
import type { TimerState } from '../state.ts';

export type Schedule = {
  delayMs: number;
  event: TimerEvent;
};

export interface TimerProfileHandler {
  readonly id: TimerProfileId;
  schedulesAfter(state: TimerState, lastEvent: TimerEvent, now: TimeSec): Schedule[];
}

export const ipscRandomStartHandler: TimerProfileHandler = {
  id: 'ipscRandomStart',
  schedulesAfter(state, lastEvent, now) {
    if (lastEvent.type === 'ARM' && state.phase === 'armed') {
      return [
        {
          delayMs: Math.round(state.delayRemainingSec * 1000),
          event: { type: 'RANDOM_DELAY_ELAPSED', at: timeSec(now + state.delayRemainingSec) },
        },
      ];
    }
    if (lastEvent.type === 'RANDOM_DELAY_ELAPSED' && state.phase === 'armed') {
      return [{ delayMs: 0, event: { type: 'START_BEEP', at: now } }];
    }
    if (lastEvent.type === 'START_BEEP' && state.parSeconds !== null) {
      return [
        {
          delayMs: Math.round(state.parSeconds * 1000),
          event: { type: 'PAR_END', at: timeSec(now + state.parSeconds) },
        },
      ];
    }
    if (lastEvent.type === 'VISIBILITY_VISIBLE' && state.phase === 'armed' && state.delayRemainingSec > 0) {
      return [
        {
          delayMs: Math.round(state.delayRemainingSec * 1000),
          event: { type: 'RANDOM_DELAY_ELAPSED', at: timeSec(now + state.delayRemainingSec) },
        },
      ];
    }
    if (
      lastEvent.type === 'VISIBILITY_VISIBLE' &&
      state.phase === 'running' &&
      state.remainingParSec !== null &&
      state.remainingParSec > 0
    ) {
      return [
        {
          delayMs: Math.round(state.remainingParSec * 1000),
          event: { type: 'PAR_END', at: timeSec(now + state.remainingParSec) },
        },
      ];
    }
    return [];
  },
};

export const issfParCountdownHandler: TimerProfileHandler = {
  id: 'issfParCountdown',
  schedulesAfter(state, lastEvent, now) {
    if (lastEvent.type === 'ARM' && state.phase === 'prep') {
      return [
        {
          delayMs: Math.round(state.prepRemainingSec * 1000),
          event: { type: 'START_BEEP', at: timeSec(now + state.prepRemainingSec) },
        },
      ];
    }
    if (lastEvent.type === 'ARM' && state.phase === 'armed') {
      return [{ delayMs: 0, event: { type: 'START_BEEP', at: now } }];
    }
    if (lastEvent.type === 'START_BEEP' && state.parSeconds !== null) {
      return [
        {
          delayMs: Math.round(state.parSeconds * 1000),
          event: { type: 'PAR_END', at: timeSec(now + state.parSeconds) },
        },
      ];
    }
    if (lastEvent.type === 'VISIBILITY_VISIBLE' && state.phase === 'prep' && state.prepRemainingSec > 0) {
      return [
        {
          delayMs: Math.round(state.prepRemainingSec * 1000),
          event: { type: 'START_BEEP', at: timeSec(now + state.prepRemainingSec) },
        },
      ];
    }
    if (
      lastEvent.type === 'VISIBILITY_VISIBLE' &&
      state.phase === 'running' &&
      state.remainingParSec !== null &&
      state.remainingParSec > 0
    ) {
      return [
        {
          delayMs: Math.round(state.remainingParSec * 1000),
          event: { type: 'PAR_END', at: timeSec(now + state.remainingParSec) },
        },
      ];
    }
    return [];
  },
};

export const issfExposureSequenceHandler: TimerProfileHandler = {
  id: 'issfExposureSequence',
  schedulesAfter(state, lastEvent, now) {
    const spec = state.exposures;
    if (!spec) {
      return [];
    }
    if (lastEvent.type === 'ARM') {
      return [{ delayMs: 0, event: { type: 'START_BEEP', at: now } }];
    }
    if (lastEvent.type === 'START_BEEP') {
      return [{ delayMs: 0, event: { type: 'EXPOSURE_OPEN', at: now, exposureIndex: 0 } }];
    }
    if (lastEvent.type === 'EXPOSURE_OPEN') {
      return [
        {
          delayMs: Math.round(spec.windowSec * 1000),
          event: {
            type: 'EXPOSURE_CLOSE',
            at: timeSec(now + spec.windowSec),
            exposureIndex: lastEvent.exposureIndex,
          },
        },
      ];
    }
    if (lastEvent.type === 'EXPOSURE_CLOSE' && lastEvent.exposureIndex < spec.count - 1) {
      const next = lastEvent.exposureIndex + 1;
      return [
        {
          delayMs: Math.round(spec.pauseSec * 1000),
          event: { type: 'EXPOSURE_OPEN', at: timeSec(now + spec.pauseSec), exposureIndex: next },
        },
      ];
    }
    if (lastEvent.type === 'VISIBILITY_VISIBLE' && state.phase === 'running' && state.exposureOpen) {
      return [
        {
          delayMs: Math.round(state.remainingWindowSec * 1000),
          event: {
            type: 'EXPOSURE_CLOSE',
            at: timeSec(now + state.remainingWindowSec),
            exposureIndex: state.currentExposureIndex ?? 0,
          },
        },
      ];
    }
    if (
      lastEvent.type === 'VISIBILITY_VISIBLE' &&
      state.phase === 'running' &&
      !state.exposureOpen &&
      state.currentExposureIndex !== null &&
      spec.count - 1 > state.currentExposureIndex
    ) {
      return [
        {
          delayMs: Math.round(state.remainingPauseSec * 1000),
          event: {
            type: 'EXPOSURE_OPEN',
            at: timeSec(now + state.remainingPauseSec),
            exposureIndex: state.currentExposureIndex + 1,
          },
        },
      ];
    }
    return [];
  },
};

export class ProfileHandlerRegistry {
  private readonly map = new Map<TimerProfileId, TimerProfileHandler>();

  constructor(initial: TimerProfileHandler[] = [
    ipscRandomStartHandler,
    issfParCountdownHandler,
    issfExposureSequenceHandler,
  ]) {
    for (const handler of initial) {
      this.map.set(handler.id, handler);
    }
  }

  get(id: TimerProfileId): TimerProfileHandler {
    const handler = this.map.get(id);
    if (!handler) {
      throw new Error(`No timer profile handler for ${id}`);
    }
    return handler;
  }

  register(handler: TimerProfileHandler): void {
    this.map.set(handler.id, handler);
  }
}

export const defaultProfileRegistry = new ProfileHandlerRegistry();
