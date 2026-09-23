import type { DrillId } from '../value-objects/ids.ts';

export type TimerProfileId = 'ipscRandomStart' | 'issfParCountdown' | 'issfExposureSequence';

export type DrillCategory = 'ipsc' | 'issf';

export type RecommendedInput = 'live' | 'dryPar' | 'dryTap';

export type InputMethod = 'live' | 'dryPar' | 'dryTap' | 'dryParTap';

export const INPUT_METHODS: readonly InputMethod[] = ['live', 'dryPar', 'dryTap', 'dryParTap'];

export type ExposureSpec = {
  count: number;
  windowSec: number;
  pauseSec: number;
};

export type Drill = {
  id: DrillId;
  category: DrillCategory;
  timerProfile: TimerProfileId;
  expectedShots: number | null;
  parSeconds?: number;
  exposures?: ExposureSpec;
  prepSeconds?: number;
  recommendedInput: RecommendedInput[];
  titleKey: string;
  briefKey: string;
};

export type RunConfig = {
  drillId: DrillId;
  inputMethod: InputMethod;
  parSecondsOverride?: number;
};
