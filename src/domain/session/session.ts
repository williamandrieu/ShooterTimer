import type { DrillId, ShotIndex, SplitSec, TimeSec } from '../value-objects/ids.ts';
import type { InputMethod, TimerProfileId } from '../drills/types.ts';
import type { MicPreset } from '../settings/settings.ts';

export type ShotEvent = {
  index: ShotIndex;
  time: TimeSec;
  split: SplitSec | null;
  exposureIndex?: number;
  inWindow: boolean;
  targetIndex: number;
};

export type Session = {
  id: string;
  createdAt: number;
  drillId: DrillId;
  timerProfile: TimerProfileId;
  inputMethod: InputMethod;
  shots: ShotEvent[];
  firstShotSec: TimeSec | null;
  totalSec: TimeSec | null;
  settingsSnapshot: { sensitivity: number; preset: MicPreset };
  shooterName?: string;
};

export function firstShotTime(shots: ShotEvent[]): TimeSec | null {
  const first = shots[0];
  return first ? first.time : null;
}

export function lastShotTime(shots: ShotEvent[]): TimeSec | null {
  const last = shots[shots.length - 1];
  return last ? last.time : null;
}
