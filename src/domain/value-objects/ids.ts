import { AppErrorCode, appError } from '../errors.ts';
import { err, ok, type Result } from '../result.ts';

export type TimeSec = number & { readonly __brand: 'TimeSec' };
export type SplitSec = number & { readonly __brand: 'SplitSec' };
export type DrillId = string & { readonly __brand: 'DrillId' };
export type ShotIndex = number & { readonly __brand: 'ShotIndex' };
export type ShooterId = string & { readonly __brand: 'ShooterId' };

export function timeSec(value: number): TimeSec {
  return value as TimeSec;
}

export function splitSec(value: number): SplitSec {
  return value as SplitSec;
}

export function drillId(value: string): DrillId {
  return value as DrillId;
}

export function shotIndex(value: number): ShotIndex {
  return value as ShotIndex;
}

export function shooterId(value: string): ShooterId {
  return value as ShooterId;
}

export function parseTimeSec(value: number): Result<TimeSec> {
  if (!Number.isFinite(value) || value < 0) {
    return err(appError(AppErrorCode.INVALID_SESSION, 'Time must be a finite non-negative number'));
  }
  return ok(timeSec(value));
}

export function parseDrillId(value: string): Result<DrillId> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return err(appError(AppErrorCode.INVALID_RUN_CONFIG, 'Drill id is required'));
  }
  return ok(drillId(trimmed));
}

export function parseShotIndex(value: number): Result<ShotIndex> {
  if (!Number.isInteger(value) || value < 1) {
    return err(appError(AppErrorCode.INVALID_SESSION, 'Shot index must be an integer >= 1'));
  }
  return ok(shotIndex(value));
}

export function parseShooterId(value: string): Result<ShooterId> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return err(appError(AppErrorCode.INVALID_SESSION, 'Shooter id is empty'));
  }
  return ok(shooterId(trimmed));
}

export function addTime(a: TimeSec, b: TimeSec): TimeSec {
  return timeSec(a + b);
}

export function subTime(a: TimeSec, b: TimeSec): TimeSec {
  return timeSec(a - b);
}

export function maxTime(a: TimeSec, b: TimeSec): TimeSec {
  return a >= b ? a : b;
}

export function minTime(a: TimeSec, b: TimeSec): TimeSec {
  return a <= b ? a : b;
}

export function asSplit(delta: TimeSec): SplitSec {
  return splitSec(delta);
}
