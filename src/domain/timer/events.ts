import type { ShotIndex, TimeSec } from '../value-objects/ids.ts';

export type TimerEvent =
  | { type: 'ARM'; at: TimeSec; delaySec: TimeSec }
  | { type: 'RANDOM_DELAY_ELAPSED'; at: TimeSec }
  | { type: 'START_BEEP'; at: TimeSec }
  | { type: 'TICK'; at: TimeSec }
  | { type: 'SHOT_RECORDED'; at: TimeSec; targetIndex: number }
  | { type: 'STOP_REQUESTED'; at: TimeSec }
  | { type: 'PAR_END'; at: TimeSec }
  | { type: 'EXPOSURE_OPEN'; at: TimeSec; exposureIndex: number }
  | { type: 'EXPOSURE_CLOSE'; at: TimeSec; exposureIndex: number }
  | { type: 'EXPECTED_SHOTS_REACHED'; at: TimeSec }
  | { type: 'VISIBILITY_HIDDEN'; at: TimeSec }
  | { type: 'VISIBILITY_VISIBLE'; at: TimeSec }
  | { type: 'DELETE_SHOT'; index: ShotIndex }
  | { type: 'RESET' };
