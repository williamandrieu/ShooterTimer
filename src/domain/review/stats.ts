import type { ShotEvent } from '../session/session.ts';
import { firstShotTime, lastShotTime } from '../session/session.ts';
import { timeSec, type TimeSec } from '../value-objects/ids.ts';
import { shouldShowWindowFlags } from '../timer/specs.ts';
import type { TimerState } from '../timer/state.ts';

export type ReviewStats = {
  firstShot: TimeSec | null;
  total: TimeSec | null;
  splitAverage: TimeSec | null;
  shotCount: number;
  outOfWindowCount: number;
  showWindowFlags: boolean;
};

export function computeReviewStats(state: TimerState): ReviewStats {
  return computeShotStats(state.shots, state.elapsedSec, shouldShowWindowFlags(state));
}

export function computeShotStats(
  shots: ShotEvent[],
  elapsed: TimeSec,
  showWindowFlags: boolean,
): ReviewStats {
  const splits = shots
    .map((shot) => shot.split)
    .filter((split): split is NonNullable<typeof split> => split !== null);
  const splitAverage =
    splits.length === 0
      ? null
      : timeSec(splits.reduce((sum, split) => sum + split, 0) / splits.length);
  return {
    firstShot: firstShotTime(shots),
    total: shots.length === 0 ? elapsed : lastShotTime(shots),
    splitAverage,
    shotCount: shots.length,
    outOfWindowCount: shots.filter((shot) => !shot.inWindow).length,
    showWindowFlags,
  };
}
