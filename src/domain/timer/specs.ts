import type { Drill, InputMethod } from '../drills/types.ts';
import { AppErrorCode, appError } from '../errors.ts';
import { err, ok, type Result } from '../result.ts';
import type { TimeSec } from '../value-objects/ids.ts';
import type { TimerState } from './state.ts';

export function canStartRun(
  drill: Drill | undefined,
  inputMethod: InputMethod,
  parSecondsOverride?: number,
): Result<Drill> {
  if (!drill) {
    return err(appError(AppErrorCode.DRILL_NOT_FOUND, 'Unknown drill'));
  }
  if (inputMethod === 'dryPar' || inputMethod === 'dryParTap') {
    const hasPar =
      drill.parSeconds !== undefined ||
      parSecondsOverride !== undefined ||
      drill.exposures !== undefined;
    if (!hasPar) {
      return err(appError(AppErrorCode.NO_PAR_WINDOW, 'This drill has no PAR window'));
    }
  }
  return ok(drill);
}

export function isShotInWindow(shotTime: TimeSec, state: TimerState): boolean {
  if (state.profile === 'issfExposureSequence') {
    return state.exposureOpen;
  }
  if (state.parSeconds === null) {
    return true;
  }
  return shotTime <= state.parSeconds;
}

export function shouldShowWindowFlags(state: TimerState): boolean {
  return state.parSeconds !== null || state.profile === 'issfExposureSequence';
}
