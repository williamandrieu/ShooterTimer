import { assertNever } from '../result.ts';
import { removeShot } from '../session/shots.ts';
import { shotIndex, splitSec, timeSec, type TimeSec } from '../value-objects/ids.ts';
import type { TimerEvent } from './events.ts';
import { emptyIdle, type TimerState } from './state.ts';
import { isShotInWindow } from './specs.ts';

function applyTick(state: TimerState, at: TimeSec): TimerState {
  if (state.phase === 'armed') {
    const nextDelay = Math.max(0, state.delayRemainingSec - lastArmedDelta(state));
    return { ...state, delayRemainingSec: timeSec(nextDelay) };
  }
  if (state.phase === 'prep') {
    const nextPrep = Math.max(0, state.prepRemainingSec - 0.05);
    return { ...state, prepRemainingSec: timeSec(nextPrep), light: 'red' };
  }
  if (state.phase === 'running' && state.beepAt !== null) {
    const elapsed = timeSec(Math.max(0, at - state.beepAt));
    const remainingPar = state.parSeconds === null ? null : timeSec(Math.max(0, state.parSeconds - elapsed));
    let remainingWindow = state.remainingWindowSec;
    let remainingPause = state.remainingPauseSec;
    const dt = timeSec(Math.max(0, at - state.beepAt - state.elapsedSec));
    if (state.exposureOpen) {
      remainingWindow = timeSec(Math.max(0, state.remainingWindowSec - dt));
    } else if (state.currentExposureIndex !== null) {
      remainingPause = timeSec(Math.max(0, state.remainingPauseSec - dt));
    }
    return {
      ...state,
      elapsedSec: elapsed,
      remainingParSec: remainingPar,
      remainingWindowSec: remainingWindow,
      remainingPauseSec: remainingPause,
      light: state.profile === 'issfExposureSequence' ? (state.exposureOpen ? 'green' : 'red') : 'off',
    };
  }
  return state;
}

function lastArmedDelta(state: TimerState): number {
  return state.delayRemainingSec > 0 ? Math.min(0.05, state.delayRemainingSec) : 0;
}

function toReview(state: TimerState, at: TimeSec): TimerState {
  const elapsed =
    state.beepAt === null ? state.elapsedSec : timeSec(Math.max(state.elapsedSec, at - state.beepAt));
  return {
    ...state,
    phase: 'review',
    previousPhase: state.phase,
    elapsedSec: elapsed,
    light: 'off',
    exposureOpen: false,
    hiddenMessage: false,
  };
}

function recordShot(state: TimerState, at: TimeSec, targetIndex: number): TimerState {
  if (state.phase !== 'running' || state.beepAt === null) {
    return state;
  }
  const time = timeSec(Math.max(0, at - state.beepAt));
  const previous = state.shots[state.shots.length - 1];
  const shot = {
    index: shotIndex(state.shots.length + 1),
    time,
    split: previous ? splitSec(time - previous.time) : null,
    exposureIndex: state.currentExposureIndex ?? undefined,
    inWindow: isShotInWindow(time, state),
    targetIndex,
  };
  const shots = [...state.shots, shot];
  const next = { ...state, shots, elapsedSec: time };
  if (state.expectedShots !== null && shots.length >= state.expectedShots) {
    return toReview(next, at);
  }
  return next;
}

export function reduceTimerState(state: TimerState, event: TimerEvent): TimerState {
  switch (event.type) {
    case 'RESET':
      return emptyIdle();
    case 'ARM':
      if (state.phase !== 'idle' && state.phase !== 'review') {
        return state;
      }
      if (state.prepSeconds > 0 && state.profile !== 'ipscRandomStart') {
        return {
          ...state,
          phase: 'prep',
          previousPhase: state.phase,
          delayRemainingSec: event.delaySec,
          prepRemainingSec: timeSec(state.prepSeconds),
          shots: [],
          elapsedSec: timeSec(0),
          beepAt: null,
          light: 'red',
          hiddenMessage: false,
          currentExposureIndex: null,
          exposureOpen: false,
        };
      }
      return {
        ...state,
        phase: 'armed',
        previousPhase: state.phase,
        delayRemainingSec: event.delaySec,
        shots: [],
        elapsedSec: timeSec(0),
        beepAt: null,
        light: state.profile === 'issfExposureSequence' ? 'red' : 'off',
        hiddenMessage: false,
        currentExposureIndex: null,
        exposureOpen: false,
      };
    case 'RANDOM_DELAY_ELAPSED':
      if (state.phase !== 'armed') {
        return state;
      }
      return { ...state, delayRemainingSec: timeSec(0) };
    case 'START_BEEP':
      if (state.phase !== 'armed' && state.phase !== 'prep' && state.phase !== 'paused') {
        return state;
      }
      return {
        ...state,
        phase: 'running',
        beepAt: event.at,
        elapsedSec: timeSec(0),
        remainingParSec: state.parSeconds === null ? null : timeSec(state.parSeconds),
        light: 'flash',
        hiddenMessage: false,
        remainingWindowSec: timeSec(state.exposures?.windowSec ?? 0),
        remainingPauseSec: timeSec(state.exposures?.pauseSec ?? 0),
      };
    case 'TICK':
      return applyTick(state, event.at);
    case 'SHOT_RECORDED':
      return recordShot(state, event.at, event.targetIndex);
    case 'STOP_REQUESTED':
      if (state.phase === 'idle' || state.phase === 'review') {
        return state;
      }
      return toReview(state, event.at);
    case 'PAR_END':
      if (state.phase !== 'running') {
        return state;
      }
      return toReview(state, event.at);
    case 'EXPOSURE_OPEN':
      if (state.phase !== 'running') {
        return state;
      }
      return {
        ...state,
        currentExposureIndex: event.exposureIndex,
        exposureOpen: true,
        light: 'green',
        remainingWindowSec: timeSec(state.exposures?.windowSec ?? 0),
      };
    case 'EXPOSURE_CLOSE': {
      if (state.phase !== 'running') {
        return state;
      }
      const count = state.exposures?.count ?? 0;
      const isLast = event.exposureIndex >= count - 1;
      if (isLast) {
        return toReview({ ...state, exposureOpen: false, light: 'red' }, event.at);
      }
      return {
        ...state,
        exposureOpen: false,
        light: 'red',
        remainingPauseSec: timeSec(state.exposures?.pauseSec ?? 0),
      };
    }
    case 'EXPECTED_SHOTS_REACHED':
      if (state.phase !== 'running') {
        return state;
      }
      return toReview(state, event.at);
    case 'VISIBILITY_HIDDEN':
      if (state.phase === 'idle' || state.phase === 'review' || state.phase === 'paused') {
        return { ...state, hiddenMessage: true };
      }
      return {
        ...applyTick(state, event.at),
        previousPhase: state.phase,
        phase: 'paused',
        hiddenMessage: true,
        light: 'off',
      };
    case 'VISIBILITY_VISIBLE': {
      if (state.phase !== 'paused') {
        return { ...state, hiddenMessage: false };
      }
      const resume = state.previousPhase ?? 'idle';
      if (resume === 'running' && state.beepAt !== null) {
        return {
          ...state,
          phase: 'running',
          beepAt: timeSec(event.at - state.elapsedSec),
          hiddenMessage: false,
        };
      }
      return { ...state, phase: resume, hiddenMessage: false };
    }
    case 'DELETE_SHOT':
      return { ...state, shots: removeShot(state.shots, event.index) };
    default:
      return assertNever(event);
  }
}
