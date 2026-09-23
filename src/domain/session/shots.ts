import type { ShotEvent } from '../session/session.ts';
import { shotIndex, splitSec, timeSec, type ShotIndex, type TimeSec } from '../value-objects/ids.ts';

export function reindexShots(shots: ShotEvent[]): ShotEvent[] {
  return shots.map((shot, i) => {
    const previous = shots[i - 1];
    return {
      ...shot,
      index: shotIndex(i + 1),
      split: previous ? splitSec(shot.time - previous.time) : null,
    };
  });
}

export function removeShot(shots: ShotEvent[], index: ShotIndex): ShotEvent[] {
  return reindexShots(shots.filter((shot) => shot.index !== index));
}

export function elapsedSinceBeep(now: TimeSec, beepAt: TimeSec | null): TimeSec {
  if (beepAt === null) {
    return timeSec(0);
  }
  return timeSec(Math.max(0, now - beepAt));
}
