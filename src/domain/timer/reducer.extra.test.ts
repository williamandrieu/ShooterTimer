import { describe, expect, it } from 'vitest';
import { reduceTimerState } from './reducer.ts';
import { createIdleState } from './state.ts';
import { getDrill } from '../drills/catalog.ts';
import { timeSec } from '../value-objects/ids.ts';

describe('extra reducer branches', () => {
  it('arms from review, beeps from paused, ignores shot without beep', () => {
    const drill = getDrill('bill-drill-6')!;
    let state = createIdleState(drill, 'dryTap');
    state = reduceTimerState(state, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) });
    state = reduceTimerState(state, { type: 'START_BEEP', at: timeSec(0) });
    state = reduceTimerState(state, { type: 'STOP_REQUESTED', at: timeSec(1) });
    expect(state.phase).toBe('review');
    state = reduceTimerState(state, { type: 'ARM', at: timeSec(2), delaySec: timeSec(0) });
    expect(state.phase).toBe('armed');
    state = reduceTimerState(state, { type: 'VISIBILITY_HIDDEN', at: timeSec(2) });
    expect(state.phase).toBe('paused');
    state = reduceTimerState(state, { type: 'START_BEEP', at: timeSec(3) });
    expect(state.phase).toBe('running');
    state = { ...state, beepAt: null };
    const ignored = reduceTimerState(state, { type: 'SHOT_RECORDED', at: timeSec(4), targetIndex: 0 });
    expect(ignored.shots).toHaveLength(0);
  });

  it('ticks armed delay to zero and exposure pause', () => {
    let state = createIdleState(getDrill('free-timer')!, 'dryTap');
    state = reduceTimerState(state, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) });
    state = reduceTimerState(state, { type: 'TICK', at: timeSec(0.05) });
    expect(state.delayRemainingSec).toBe(0);
    const rapid = getDrill('sport-rapid-3x5')!;
    let exp = createIdleState(rapid, 'dryTap');
    exp = reduceTimerState(exp, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) });
    exp = reduceTimerState(exp, { type: 'START_BEEP', at: timeSec(0) });
    exp = reduceTimerState(exp, { type: 'EXPOSURE_OPEN', at: timeSec(0), exposureIndex: 0 });
    exp = reduceTimerState(exp, { type: 'EXPOSURE_CLOSE', at: timeSec(3), exposureIndex: 0 });
    exp = reduceTimerState(exp, { type: 'TICK', at: timeSec(3.05) });
    expect(exp.remainingPauseSec).toBeLessThanOrEqual(rapid.exposures!.pauseSec);
    exp = reduceTimerState(exp, { type: 'VISIBILITY_HIDDEN', at: timeSec(3.1) });
    expect(exp.phase).toBe('paused');
    expect(reduceTimerState(exp, { type: 'VISIBILITY_HIDDEN', at: timeSec(3.2) }).phase).toBe('paused');
    exp = { ...exp, beepAt: null, previousPhase: 'running' };
    const resumed = reduceTimerState(exp, { type: 'VISIBILITY_VISIBLE', at: timeSec(4) });
    expect(resumed.phase).toBe('running');
    const idleResume = reduceTimerState(
      { ...exp, previousPhase: 'idle' },
      { type: 'VISIBILITY_VISIBLE', at: timeSec(4) },
    );
    expect(idleResume.phase).toBe('idle');
    const noBeep = reduceTimerState(
      { ...createIdleState(getDrill('free-timer')!, 'dryTap'), phase: 'running', beepAt: null },
      { type: 'TICK', at: timeSec(1) },
    );
    expect(noBeep.phase).toBe('running');
    const closed = reduceTimerState(
      {
        ...createIdleState(getDrill('free-timer')!, 'dryTap'),
        phase: 'running',
        beepAt: timeSec(0),
        exposures: null,
      },
      { type: 'EXPOSURE_CLOSE', at: timeSec(1), exposureIndex: 0 },
    );
    expect(closed.phase).toBe('review');
    expect(() =>
      reduceTimerState(createIdleState(getDrill('free-timer')!, 'dryTap'), { type: 'NOT_AN_EVENT' } as never),
    ).toThrow();
    const openNoSpec = reduceTimerState(
      {
        ...createIdleState(getDrill('free-timer')!, 'dryTap'),
        phase: 'running',
        beepAt: timeSec(0),
        exposures: null,
      },
      { type: 'EXPOSURE_OPEN', at: timeSec(1), exposureIndex: 0 },
    );
    expect(openNoSpec.remainingWindowSec).toBe(0);
    const midClose = reduceTimerState(
      {
        ...createIdleState(getDrill('sport-rapid-3x5')!, 'dryTap'),
        phase: 'running',
        beepAt: timeSec(0),
        exposures: { count: 3, windowSec: 2, pauseSec: undefined as unknown as number },
      },
      { type: 'EXPOSURE_CLOSE', at: timeSec(1), exposureIndex: 0 },
    );
    expect(midClose.remainingPauseSec).toBe(0);
    const pausedOrphan = reduceTimerState(
      {
        ...createIdleState(getDrill('free-timer')!, 'dryTap'),
        phase: 'paused',
        previousPhase: null,
        beepAt: null,
      },
      { type: 'VISIBILITY_VISIBLE', at: timeSec(1) },
    );
    expect(pausedOrphan.phase).toBe('idle');
  });
});
