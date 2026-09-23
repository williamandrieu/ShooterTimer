import { describe, expect, it } from 'vitest';
import { firstShotTime, lastShotTime, type Session } from './session.ts';
import { shotIndex, timeSec } from '../value-objects/ids.ts';
import { drillId } from '../value-objects/ids.ts';

describe('session helpers', () => {
  it('reads first and last shots', () => {
    expect(firstShotTime([])).toBeNull();
    expect(lastShotTime([])).toBeNull();
    const shots = [
      { index: shotIndex(1), time: timeSec(1), split: null, inWindow: true, targetIndex: 0 },
      { index: shotIndex(2), time: timeSec(2), split: timeSec(1) as never, inWindow: true, targetIndex: 0 },
    ];
    expect(firstShotTime(shots)?.valueOf()).toBe(1);
    expect(lastShotTime(shots)?.valueOf()).toBe(2);
    const session: Session = {
      id: '1',
      createdAt: 1,
      drillId: drillId('free-timer'),
      timerProfile: 'ipscRandomStart',
      inputMethod: 'dryTap',
      shots,
      firstShotSec: timeSec(1),
      totalSec: timeSec(2),
      settingsSnapshot: { sensitivity: 0.5, preset: 'handgun' },
    };
    expect(session.id).toBe('1');
  });
});
