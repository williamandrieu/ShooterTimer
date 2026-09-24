import type { Drill, InputMethod, TimerProfileId } from '../drills/types.ts';
import type { ShotEvent } from '../session/session.ts';
import { drillId, timeSec, type DrillId, type TimeSec } from '../value-objects/ids.ts';

export type Phase = 'idle' | 'armed' | 'prep' | 'running' | 'paused' | 'review';

export type Light = 'off' | 'red' | 'green' | 'flash';

export type TimerState = {
  phase: Phase;
  previousPhase: Phase | null;
  profile: TimerProfileId;
  drillId: DrillId;
  inputMethod: InputMethod;
  expectedShots: number | null;
  parSeconds: number | null;
  prepSeconds: number;
  exposures: { count: number; windowSec: number; pauseSec: number } | null;
  elapsedSec: TimeSec;
  remainingParSec: TimeSec | null;
  delayRemainingSec: TimeSec;
  prepRemainingSec: TimeSec;
  remainingWindowSec: TimeSec;
  remainingPauseSec: TimeSec;
  shots: ShotEvent[];
  currentExposureIndex: number | null;
  exposureOpen: boolean;
  thenExposures: { count: number; windowSec: number; pauseSec: number } | null;
  combinedStage: 'precision' | 'rapid';
  light: Light;
  beepAt: TimeSec | null;
  hiddenMessage: boolean;
};

export function createIdleState(drill: Drill, inputMethod: InputMethod, parSecondsOverride?: number): TimerState {
  const par = parSecondsOverride ?? drill.parSeconds ?? null;
  return {
    phase: 'idle',
    previousPhase: null,
    profile: drill.timerProfile,
    drillId: drill.id,
    inputMethod,
    expectedShots: drill.expectedShots,
    parSeconds: par,
    prepSeconds: drill.prepSeconds ?? 0,
    exposures: drill.exposures ?? null,
    elapsedSec: timeSec(0),
    remainingParSec: par === null ? null : timeSec(par),
    delayRemainingSec: timeSec(0),
    prepRemainingSec: timeSec(drill.prepSeconds ?? 0),
    remainingWindowSec: timeSec(drill.exposures?.windowSec ?? 0),
    remainingPauseSec: timeSec(drill.exposures?.pauseSec ?? 0),
    shots: [],
    currentExposureIndex: null,
    exposureOpen: false,
    thenExposures: drill.thenExposures ?? null,
    combinedStage: 'precision',
    light: 'off',
    beepAt: null,
    hiddenMessage: false,
  };
}

export function emptyIdle(): TimerState {
  return createIdleState(
    {
      id: drillId('free-timer'),
      category: 'ipsc',
      timerProfile: 'ipscRandomStart',
      expectedShots: null,
      recommendedInput: ['live', 'dryTap'],
      titleKey: 'drill.free.title',
      briefKey: 'drill.free.brief',
    },
    'dryTap',
  );
}
