import { describe, expect, it } from 'vitest';
import { getDrill } from '../drills/catalog.ts';
import { reduceTimerState } from './reducer.ts';
import { createIdleState, emptyIdle } from './state.ts';
import { timeSec, shotIndex } from '../value-objects/ids.ts';
import { computeReviewStats, computeShotStats } from '../review/stats.ts';
import { reindexShots, removeShot, elapsedSinceBeep } from '../session/shots.ts';

const bill = getDrill('bill-drill-6')!;
const custom = getDrill('custom-par')!;
const std = getDrill('std-pistol-20')!;
const rapid = getDrill('sport-rapid-3x5')!;

describe('timer reducer', () => {
  it('runs IPSC random start and auto-stops at expected shots', () => {
    let state = createIdleState(bill, 'dryTap');
    state = reduceTimerState(state, { type: 'ARM', at: timeSec(0), delaySec: timeSec(1) });
    expect(state.phase).toBe('armed');
    state = reduceTimerState(state, { type: 'TICK', at: timeSec(0.05) });
    state = reduceTimerState(state, { type: 'RANDOM_DELAY_ELAPSED', at: timeSec(1) });
    state = reduceTimerState(state, { type: 'START_BEEP', at: timeSec(1) });
    expect(state.phase).toBe('running');
    expect(state.light).toBe('flash');
    for (let i = 0; i < 6; i += 1) {
      state = reduceTimerState(state, { type: 'SHOT_RECORDED', at: timeSec(1.2 + i * 0.2), targetIndex: 0 });
    }
    expect(state.phase).toBe('review');
    expect(state.shots).toHaveLength(6);
    const stats = computeReviewStats(state);
    expect(stats.shotCount).toBe(6);
    expect(stats.firstShot).not.toBeNull();
    expect(stats.splitAverage).not.toBeNull();
  });

  it('ignores illegal transitions and handles pause/resume', () => {
    let state = createIdleState(custom, 'dryPar', 3);
    expect(reduceTimerState(state, { type: 'RANDOM_DELAY_ELAPSED', at: timeSec(0) }).phase).toBe('idle');
    expect(reduceTimerState(state, { type: 'START_BEEP', at: timeSec(0) }).phase).toBe('idle');
    expect(reduceTimerState(state, { type: 'SHOT_RECORDED', at: timeSec(1), targetIndex: 0 }).shots).toHaveLength(0);
    expect(reduceTimerState(state, { type: 'STOP_REQUESTED', at: timeSec(1) }).phase).toBe('idle');
    expect(reduceTimerState(state, { type: 'PAR_END', at: timeSec(1) }).phase).toBe('idle');
    expect(reduceTimerState(state, { type: 'EXPOSURE_OPEN', at: timeSec(1), exposureIndex: 0 }).phase).toBe('idle');
    expect(reduceTimerState(state, { type: 'EXPOSURE_CLOSE', at: timeSec(1), exposureIndex: 0 }).phase).toBe('idle');
    expect(reduceTimerState(state, { type: 'EXPECTED_SHOTS_REACHED', at: timeSec(1) }).phase).toBe('idle');
    state = reduceTimerState(state, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0.5) });
    expect(reduceTimerState(state, { type: 'ARM', at: timeSec(1), delaySec: timeSec(1) }).phase).toBe('armed');
    state = reduceTimerState(state, { type: 'START_BEEP', at: timeSec(1) });
    state = reduceTimerState(state, { type: 'TICK', at: timeSec(1.5) });
    expect(state.elapsedSec).toBeGreaterThan(0);
    state = reduceTimerState(state, { type: 'VISIBILITY_HIDDEN', at: timeSec(1.5) });
    expect(state.phase).toBe('paused');
    state = reduceTimerState(state, { type: 'VISIBILITY_VISIBLE', at: timeSec(2) });
    expect(state.phase).toBe('running');
    state = reduceTimerState(state, { type: 'PAR_END', at: timeSec(4) });
    expect(state.phase).toBe('review');
    expect(reduceTimerState(state, { type: 'STOP_REQUESTED', at: timeSec(5) }).phase).toBe('review');
    state = reduceTimerState(state, { type: 'RESET' });
    expect(state.phase).toBe('idle');
    expect(emptyIdle().drillId).toBe('free-timer');
  });

  it('handles ISSF prep, ticks, expected shots event, visibility on idle', () => {
    const drill = { ...std, prepSeconds: 1 };
    let state = createIdleState(drill, 'live');
    state = reduceTimerState(state, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) });
    expect(state.phase).toBe('prep');
    state = reduceTimerState(state, { type: 'TICK', at: timeSec(0.1) });
    expect(state.light).toBe('red');
    state = reduceTimerState(state, { type: 'START_BEEP', at: timeSec(1) });
    state = reduceTimerState(state, { type: 'SHOT_RECORDED', at: timeSec(1.1), targetIndex: 0 });
    state = reduceTimerState(state, { type: 'EXPECTED_SHOTS_REACHED', at: timeSec(1.2) });
    expect(state.phase).toBe('review');
    const idle = createIdleState(getDrill('free-timer')!, 'dryTap');
    expect(reduceTimerState(idle, { type: 'VISIBILITY_HIDDEN', at: timeSec(0) }).hiddenMessage).toBe(true);
    expect(reduceTimerState(idle, { type: 'VISIBILITY_VISIBLE', at: timeSec(0) }).hiddenMessage).toBe(false);
    expect(reduceTimerState(idle, { type: 'TICK', at: timeSec(1) }).phase).toBe('idle');
  });

  it('runs exposure sequence and deletes shots', () => {
    const immediate = reduceTimerState(
      createIdleState({ ...rapid, prepSeconds: 0 }, 'dryTap'),
      { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) },
    );
    expect(immediate.phase).toBe('armed');
    expect(immediate.light).toBe('red');
    let state = createIdleState(rapid, 'dryTap');
    state = reduceTimerState(state, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) });
    state = reduceTimerState(state, { type: 'START_BEEP', at: timeSec(0) });
    state = reduceTimerState(state, { type: 'EXPOSURE_OPEN', at: timeSec(0), exposureIndex: 0 });
    expect(state.light).toBe('green');
    state = reduceTimerState(state, { type: 'TICK', at: timeSec(0.2) });
    state = reduceTimerState(state, { type: 'SHOT_RECORDED', at: timeSec(0.2), targetIndex: 0 });
    expect(state.shots[0]?.inWindow).toBe(true);
    state = reduceTimerState(state, { type: 'EXPOSURE_CLOSE', at: timeSec(3), exposureIndex: 0 });
    expect(state.exposureOpen).toBe(false);
    state = reduceTimerState(state, { type: 'TICK', at: timeSec(3.2) });
    state = reduceTimerState(state, { type: 'EXPOSURE_OPEN', at: timeSec(4), exposureIndex: 1 });
    state = reduceTimerState(state, { type: 'EXPOSURE_CLOSE', at: timeSec(7), exposureIndex: 4 });
    expect(state.phase).toBe('review');
    const remaining = removeShot(state.shots, shotIndex(1));
    expect(remaining.length).toBe(state.shots.length - 1);
    expect(reindexShots(state.shots)[0]?.index).toBe(1);
    expect(elapsedSinceBeep(timeSec(2), null)).toBe(0);
    expect(elapsedSinceBeep(timeSec(2), timeSec(1))).toBe(1);
    expect(reduceTimerState(state, { type: 'DELETE_SHOT', index: shotIndex(1) }).shots).toHaveLength(0);
    const emptyStats = computeReviewStats(createIdleState(bill, 'dryTap'));
    expect(emptyStats.splitAverage).toBeNull();
    expect(emptyStats.total).toBe(0);
    expect(emptyStats.outOfWindowCount).toBe(0);
    const flagged = computeShotStats(
      [{ index: shotIndex(1), time: timeSec(1), split: null, inWindow: false, targetIndex: 0 }],
      timeSec(1),
      true,
    );
    expect(flagged.outOfWindowCount).toBe(1);
    expect(flagged.total).toBe(1);
  });

  it('resumes non-running pause and ignores extra expected shots', () => {
    let state = createIdleState(bill, 'dryTap');
    state = reduceTimerState(state, { type: 'ARM', at: timeSec(0), delaySec: timeSec(2) });
    state = reduceTimerState(state, { type: 'VISIBILITY_HIDDEN', at: timeSec(0.2) });
    state = reduceTimerState(state, { type: 'VISIBILITY_VISIBLE', at: timeSec(1) });
    expect(state.phase).toBe('armed');
    expect(reduceTimerState(state, { type: 'EXPECTED_SHOTS_REACHED', at: timeSec(1) }).phase).toBe('armed');
    expect(reduceTimerState(state, { type: 'EXPOSURE_OPEN', at: timeSec(1), exposureIndex: 0 }).phase).toBe('armed');
    expect(reduceTimerState(state, { type: 'EXPOSURE_CLOSE', at: timeSec(1), exposureIndex: 0 }).phase).toBe('armed');
    const stopped = reduceTimerState(state, { type: 'STOP_REQUESTED', at: timeSec(1) });
    expect(stopped.phase).toBe('review');
    let free = createIdleState(getDrill('free-timer')!, 'dryTap');
    free = reduceTimerState(free, { type: 'ARM', at: timeSec(0), delaySec: timeSec(0) });
    free = reduceTimerState(free, { type: 'START_BEEP', at: timeSec(0) });
    free = reduceTimerState(free, { type: 'SHOT_RECORDED', at: timeSec(0.3), targetIndex: 0 });
    expect(free.phase).toBe('running');
    free = reduceTimerState(free, { type: 'TICK', at: timeSec(0.3) });
    expect(free.light).toBe('off');
  });
});
