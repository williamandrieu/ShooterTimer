import { describe, expect, it } from 'vitest';
import { AppErrorCode, appError } from './errors.ts';
import { assertNever, err, fromThrowable, mapResult, ok, unwrapOr } from './result.ts';
import {
  addTime,
  drillId,
  maxTime,
  minTime,
  parseDrillId,
  parseShooterId,
  parseShotIndex,
  parseTimeSec,
  shooterId,
  shotIndex,
  splitSec,
  subTime,
  timeSec,
  asSplit,
} from './value-objects/ids.ts';
import { requirePort } from '../ports/contracts.ts';
import { clampDelayRange, mergeSettings, resolveLocale, DEFAULT_SETTINGS, continueRunHref, liveFireHref, normalizeMicPermissionState, reconcileMicGranted, withMicPermission } from './settings/settings.ts';
import { canStartRun, isShotInWindow, shouldShowWindowFlags } from './timer/specs.ts';
import { createIdleState } from './timer/state.ts';
import { getDrill } from './drills/catalog.ts';
import { FiveTargetSequence, SingleWindowTargetSequence } from './drills/targetSequence.ts';
import { INPUT_METHODS } from './drills/types.ts';

describe('result and errors', () => {
  it('maps and unwraps', () => {
    expect(mapResult(ok(2), (n) => n * 2)).toEqual(ok(4));
    expect(mapResult(err(appError(AppErrorCode.IDB_READ, 'x')), (n: number) => n)).toEqual(
      err(appError(AppErrorCode.IDB_READ, 'x')),
    );
    expect(unwrapOr(ok(1), 0)).toBe(1);
    expect(unwrapOr(err(appError(AppErrorCode.IDB_READ, 'x')), 9)).toBe(9);
    expect(fromThrowable(() => 1, AppErrorCode.IDB_READ, 'm').ok).toBe(true);
    expect(fromThrowable(() => {
      throw new Error('boom');
    }, AppErrorCode.IDB_READ, 'm').ok).toBe(false);
    expect(appError(AppErrorCode.IDB_READ, 'm', 1).cause).toBe(1);
    expect(() => assertNever('nope' as never)).toThrow();
  });
});

describe('value objects', () => {
  it('parses and arithmetics', () => {
    expect(parseTimeSec(Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(parseTimeSec(Number.NaN).ok).toBe(false);
    expect(parseTimeSec(-1).ok).toBe(false);
    expect(parseShotIndex(1.5).ok).toBe(false);
    expect(maxTime(timeSec(3), timeSec(2))).toBe(3);
    expect(minTime(timeSec(3), timeSec(2))).toBe(2);
    expect(parseTimeSec(1).ok).toBe(true);
    expect(parseDrillId('  ').ok).toBe(false);
    expect(parseDrillId('bill').ok).toBe(true);
    expect(parseShotIndex(0).ok).toBe(false);
    expect(parseShotIndex(1).ok).toBe(true);
    expect(parseShooterId('').ok).toBe(false);
    expect(parseShooterId('ana').ok).toBe(true);
    expect(addTime(timeSec(1), timeSec(2))).toBe(3);
    expect(subTime(timeSec(3), timeSec(1))).toBe(2);
    expect(maxTime(timeSec(1), timeSec(2))).toBe(2);
    expect(minTime(timeSec(1), timeSec(2))).toBe(1);
    expect(asSplit(timeSec(0.2))).toBe(0.2);
    expect(shotIndex(1)).toBe(1);
    expect(splitSec(1)).toBe(1);
    expect(shooterId('x')).toBe('x');
    expect(drillId('x')).toBe('x');
  });
});

describe('settings helpers', () => {
  it('resolves locale and clamps delay', () => {
    expect(resolveLocale('fr-FR')).toBe('fr');
    expect(resolveLocale('pl-PL')).toBe('pl');
    expect(resolveLocale('de')).toBe('en');
    expect(clampDelayRange(-1, 0.5)).toEqual({ min: 0, max: 0.5 });
    expect(clampDelayRange(4, 1)).toEqual({ min: 4, max: 4 });
    expect(mergeSettings({ beepVolume: 0.1 }).beepVolume).toBe(0.1);
    expect(DEFAULT_SETTINGS.locale).toBe('en');
    expect(DEFAULT_SETTINGS.micGranted).toBe(false);
    expect(INPUT_METHODS).toContain('dryParTap');
    expect(normalizeMicPermissionState('granted')).toBe('granted');
    expect(normalizeMicPermissionState('denied')).toBe('denied');
    expect(normalizeMicPermissionState('prompt')).toBe('prompt');
    expect(normalizeMicPermissionState('error')).toBe('unknown');
    expect(reconcileMicGranted(false, 'granted')).toBe(true);
    expect(reconcileMicGranted(true, 'denied')).toBe(false);
    expect(reconcileMicGranted(true, 'prompt')).toBe(true);
    expect(reconcileMicGranted(false, 'unknown')).toBe(false);
    expect(withMicPermission(DEFAULT_SETTINGS, 'prompt')).toBe(DEFAULT_SETTINGS);
    expect(withMicPermission(DEFAULT_SETTINGS, 'granted').micGranted).toBe(true);
    expect(continueRunHref('bill-drill-6', 'dryTap')).toBe('/run?drillId=bill-drill-6&input=dryTap');
    expect(liveFireHref('bill-drill-6', false)).toBe('/preflight?drillId=bill-drill-6&input=live');
    expect(liveFireHref('bill-drill-6', true)).toBe('/run?drillId=bill-drill-6&input=live');
    expect(liveFireHref('a b', false)).toContain('a%20b');
  });
});

describe('specs and targets', () => {
  it('validates start and windows', () => {
    expect(canStartRun(undefined, 'live').ok).toBe(false);
    const free = getDrill('free-timer');
    expect(canStartRun(free, 'dryPar').ok).toBe(false);
    expect(canStartRun(free, 'dryParTap').ok).toBe(false);
    expect(canStartRun(free, 'dryPar', 2).ok).toBe(true);
    const rapid = getDrill('sport-rapid-3x5');
    expect(canStartRun(rapid, 'dryPar').ok).toBe(true);
    expect(canStartRun(free, 'live').ok).toBe(true);
    const idle = createIdleState(free!, 'dryTap');
    expect(isShotInWindow(timeSec(1), idle)).toBe(true);
    const par = createIdleState(getDrill('custom-par')!, 'dryPar');
    par.profile = 'issfParCountdown';
    par.parSeconds = 2;
    expect(isShotInWindow(timeSec(3), par)).toBe(false);
    expect(isShotInWindow(timeSec(1), par)).toBe(true);
    const exp = createIdleState(rapid!, 'dryTap');
    exp.profile = 'issfExposureSequence';
    exp.exposureOpen = true;
    expect(isShotInWindow(timeSec(9), exp)).toBe(true);
    exp.exposureOpen = false;
    expect(isShotInWindow(timeSec(9), exp)).toBe(false);
    expect(shouldShowWindowFlags(par)).toBe(true);
    expect(shouldShowWindowFlags(idle)).toBe(false);
    const five = new FiveTargetSequence();
    expect(five.targetCount()).toBe(5);
    expect(five.assignShotToTarget(0)).toBe(0);
    expect(five.assignShotToTarget(2)).toBe(1);
    expect(five.assignShotToTarget(6)).toBe(0);
    expect(new SingleWindowTargetSequence().assignShotToTarget(3)).toBe(0);
    expect(new SingleWindowTargetSequence().targetCount()).toBe(1);
  });
});

describe('requirePort', () => {
  it('throws when missing', () => {
    expect(requirePort(1, 'x')).toBe(1);
    expect(() => requirePort(undefined, 'clock')).toThrow(/clock/);
  });
});
