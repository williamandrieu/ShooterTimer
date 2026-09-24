import { describe, expect, it } from 'vitest';
import { getDrill } from '../../drills/catalog.ts';
import {
  ProfileHandlerRegistry,
  defaultProfileRegistry,
  ipscRandomStartHandler,
  issfCombinedHandler,
  issfExposureSequenceHandler,
  issfParCountdownHandler,
} from './index.ts';
import { createIdleState } from '../state.ts';
import { reduceTimerState } from '../reducer.ts';
import { timeSec } from '../../value-objects/ids.ts';

describe('profile handlers', () => {
  it('schedules IPSC delay, beep and PAR', () => {
    const drill = getDrill('custom-par')!;
    let state = createIdleState(drill, 'dryPar');
    const arm = { type: 'ARM' as const, at: timeSec(0), delaySec: timeSec(1) };
    state = reduceTimerState(state, arm);
    expect(ipscRandomStartHandler.schedulesAfter(state, arm, timeSec(0))[0]?.event.type).toBe('RANDOM_DELAY_ELAPSED');
    const elapsed = { type: 'RANDOM_DELAY_ELAPSED' as const, at: timeSec(1) };
    state = reduceTimerState(state, elapsed);
    expect(ipscRandomStartHandler.schedulesAfter(state, elapsed, timeSec(1))[0]?.event.type).toBe('START_BEEP');
    const beep = { type: 'START_BEEP' as const, at: timeSec(1) };
    state = reduceTimerState(state, beep);
    expect(ipscRandomStartHandler.schedulesAfter(state, beep, timeSec(1))[0]?.event.type).toBe('PAR_END');
    expect(ipscRandomStartHandler.schedulesAfter(state, { type: 'TICK', at: timeSec(1) }, timeSec(1))).toEqual([]);
    state.phase = 'armed';
    state.delayRemainingSec = timeSec(0.4);
    expect(
      ipscRandomStartHandler.schedulesAfter(state, { type: 'VISIBILITY_VISIBLE', at: timeSec(2) }, timeSec(2))[0]
        ?.event.type,
    ).toBe('RANDOM_DELAY_ELAPSED');
    state.phase = 'running';
    state.remainingParSec = timeSec(1);
    expect(
      ipscRandomStartHandler.schedulesAfter(state, { type: 'VISIBILITY_VISIBLE', at: timeSec(2) }, timeSec(2))[0]
        ?.event.type,
    ).toBe('PAR_END');
  });

  it('schedules ISSF PAR prep and exposure windows', () => {
    const std = getDrill('std-pistol-20')!;
    let state = createIdleState({ ...std, prepSeconds: 60 }, 'live');
    const arm = { type: 'ARM' as const, at: timeSec(0), delaySec: timeSec(0) };
    state = reduceTimerState(state, arm);
    expect(issfParCountdownHandler.schedulesAfter(state, arm, timeSec(0))[0]?.event.type).toBe('START_BEEP');
    const noPrep = createIdleState({ ...std, prepSeconds: 0 }, 'live');
    const armed = reduceTimerState(noPrep, arm);
    expect(issfParCountdownHandler.schedulesAfter(armed, arm, timeSec(0))[0]?.delayMs).toBe(0);
    const running = reduceTimerState(armed, { type: 'START_BEEP', at: timeSec(0) });
    expect(issfParCountdownHandler.schedulesAfter(running, { type: 'START_BEEP', at: timeSec(0) }, timeSec(0)).length).toBe(
      1,
    );
    running.phase = 'prep';
    running.prepRemainingSec = timeSec(1);
    expect(
      issfParCountdownHandler.schedulesAfter(running, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1))[0]
        ?.event.type,
    ).toBe('START_BEEP');
    running.phase = 'running';
    running.remainingParSec = timeSec(2);
    expect(
      issfParCountdownHandler.schedulesAfter(running, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1))[0]
        ?.event.type,
    ).toBe('PAR_END');
    expect(issfParCountdownHandler.schedulesAfter(running, { type: 'TICK', at: timeSec(1) }, timeSec(1))).toEqual([]);

    const rapid = getDrill('sport-rapid-3x5')!;
    let exp = createIdleState(rapid, 'dryTap');
    expect(issfExposureSequenceHandler.schedulesAfter(exp, arm, timeSec(0))[0]?.event.type).toBe('START_BEEP');
    const prepped = reduceTimerState(exp, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) });
    expect(prepped.phase).toBe('prep');
    expect(
      issfExposureSequenceHandler.schedulesAfter(prepped, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) }, timeSec(0))[0]
        ?.delayMs,
    ).toBe(7_000);
    expect(
      issfExposureSequenceHandler.schedulesAfter(prepped, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1))[0]
        ?.event.type,
    ).toBe('START_BEEP');
    exp = reduceTimerState(exp, { type: 'START_BEEP', at: timeSec(0) });
    expect(
      issfExposureSequenceHandler.schedulesAfter(exp, { type: 'START_BEEP', at: timeSec(0) }, timeSec(0))[0]?.event.type,
    ).toBe('EXPOSURE_OPEN');
    const open = { type: 'EXPOSURE_OPEN' as const, at: timeSec(0), exposureIndex: 0 };
    expect(issfExposureSequenceHandler.schedulesAfter(exp, open, timeSec(0))[0]?.event.type).toBe('EXPOSURE_CLOSE');
    const close = { type: 'EXPOSURE_CLOSE' as const, at: timeSec(3), exposureIndex: 0 };
    expect(issfExposureSequenceHandler.schedulesAfter(exp, close, timeSec(3))[0]?.event.type).toBe('EXPOSURE_OPEN');
    expect(
      issfExposureSequenceHandler.schedulesAfter(exp, { type: 'EXPOSURE_CLOSE', at: timeSec(3), exposureIndex: 4 }, timeSec(3)),
    ).toEqual([]);
    exp.phase = 'running';
    exp.exposureOpen = true;
    exp.remainingWindowSec = timeSec(1);
    exp.currentExposureIndex = 0;
    expect(
      issfExposureSequenceHandler.schedulesAfter(exp, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1))[0]
        ?.event.type,
    ).toBe('EXPOSURE_CLOSE');
    exp.exposureOpen = false;
    exp.remainingPauseSec = timeSec(1);
    expect(
      issfExposureSequenceHandler.schedulesAfter(exp, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1))[0]
        ?.event.type,
    ).toBe('EXPOSURE_OPEN');
    expect(issfExposureSequenceHandler.schedulesAfter(exp, { type: 'TICK', at: timeSec(1) }, timeSec(1))).toEqual([]);
    const noSpec = { ...exp, exposures: null };
    expect(issfExposureSequenceHandler.schedulesAfter(noSpec, arm, timeSec(0))).toEqual([]);
  });

  it('registry get/register and missing handler', () => {
    const empty = new ProfileHandlerRegistry([]);
    expect(() => empty.get('ipscRandomStart')).toThrow();
    empty.register(ipscRandomStartHandler);
    expect(empty.get('ipscRandomStart').id).toBe('ipscRandomStart');
    expect(defaultProfileRegistry.get('issfParCountdown').id).toBe('issfParCountdown');
    expect(defaultProfileRegistry.get('issfCombined').id).toBe('issfCombined');
  });

  it('returns empty schedules on unmatched events', () => {
    const free = createIdleState(getDrill('free-timer')!, 'dryTap');
    const armed = reduceTimerState(free, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) });
    const beeped = reduceTimerState(armed, { type: 'START_BEEP', at: timeSec(0) });
    expect(ipscRandomStartHandler.schedulesAfter(beeped, { type: 'START_BEEP', at: timeSec(0) }, timeSec(0))).toEqual(
      [],
    );
    armed.delayRemainingSec = timeSec(0);
    expect(
      ipscRandomStartHandler.schedulesAfter(armed, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1)),
    ).toEqual([]);
    beeped.remainingParSec = timeSec(0);
    expect(
      ipscRandomStartHandler.schedulesAfter(beeped, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1)),
    ).toEqual([]);
    const std = createIdleState({ ...getDrill('std-pistol-20')!, prepSeconds: 0 }, 'live');
    expect(issfParCountdownHandler.schedulesAfter(std, { type: 'TICK', at: timeSec(0) }, timeSec(0))).toEqual([]);
    std.phase = 'prep';
    std.prepRemainingSec = timeSec(0);
    expect(
      issfParCountdownHandler.schedulesAfter(std, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1)),
    ).toEqual([]);
    const rapid = createIdleState(getDrill('sport-rapid-3x5')!, 'dryTap');
    rapid.phase = 'running';
    rapid.exposureOpen = true;
    rapid.currentExposureIndex = null;
    rapid.remainingWindowSec = timeSec(1);
    expect(
      issfExposureSequenceHandler.schedulesAfter(rapid, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1))[0]
        ?.event.type,
    ).toBe('EXPOSURE_CLOSE');
    rapid.exposureOpen = false;
    rapid.currentExposureIndex = 4;
    expect(
      issfExposureSequenceHandler.schedulesAfter(rapid, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) }, timeSec(1)),
    ).toEqual([]);
  });

  it('chains combined precision into the rapid exposures', () => {
    const idle = createIdleState(getDrill('combined-25')!, 'dryPar');
    const armed = reduceTimerState(idle, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) });
    expect(issfCombinedHandler.schedulesAfter(armed, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) }, timeSec(0))[0]?.event.type).toBe(
      'START_BEEP',
    );
    const running = reduceTimerState(armed, { type: 'START_BEEP', at: timeSec(1) });
    const ended = reduceTimerState(running, { type: 'PAR_END', at: timeSec(2) });
    expect(ended.combinedStage).toBe('rapid');
    expect(
      issfCombinedHandler.schedulesAfter(ended, { type: 'PAR_END', at: timeSec(2) }, timeSec(2))[0]?.event.type,
    ).toBe('EXPOSURE_OPEN');
    const open = reduceTimerState(ended, { type: 'EXPOSURE_OPEN', at: timeSec(2), exposureIndex: 0 });
    expect(
      issfCombinedHandler.schedulesAfter(open, { type: 'EXPOSURE_OPEN', at: timeSec(2), exposureIndex: 0 }, timeSec(2))[0]
        ?.event.type,
    ).toBe('EXPOSURE_CLOSE');
  });
});
