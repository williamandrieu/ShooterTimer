import { describe, expect, it } from 'vitest';
import {
  isInputMethod,
  parseDrillDefinition,
  parseRunSearchParams,
  parseSessionRecord,
  parseSettings,
  sessionFromRecord,
  sessionToRecord,
} from './schemas.ts';
import { getDrill } from '../domain/drills/catalog.ts';
import { drillId, shotIndex, timeSec } from '../domain/value-objects/ids.ts';
import type { Session } from '../domain/session/session.ts';

describe('validation schemas', () => {
  it('parses run params and rejects junk', () => {
    const okResult = parseRunSearchParams('?drillId=bill-drill-6&input=dryTap&par=5');
    expect(okResult.ok).toBe(true);
    expect(parseRunSearchParams('drillId=&input=nope').ok).toBe(false);
    expect(isInputMethod('live')).toBe(true);
    expect(isInputMethod('x')).toBe(false);
  });

  it('parses settings with inverted delay and invalid payload', () => {
    expect(parseSettings(null).locale).toBe('en');
    const parsed = parseSettings({
      locale: 'fr',
      ipscDelayMinSec: 3,
      ipscDelayMaxSec: 1,
      beepVolume: 0.2,
      flashEnabled: true,
      vibrationEnabled: false,
      micPreset: 'indoor',
      micSensitivity: 0.4,
      reducedMotion: true,
    });
    expect(parsed.ipscDelayMaxSec).toBe(3);
    expect(parsed.locale).toBe('fr');
    expect(parsed.micGranted).toBe(false);
    const granted = parseSettings({
      locale: 'en',
      ipscDelayMinSec: 1,
      ipscDelayMaxSec: 4,
      beepVolume: 0.9,
      flashEnabled: true,
      vibrationEnabled: true,
      micPreset: 'handgun',
      micSensitivity: 0.55,
      reducedMotion: false,
      micGranted: true,
    });
    expect(granted.micGranted).toBe(true);
    const ordered = parseSettings({
      locale: 'en',
      ipscDelayMinSec: 1,
      ipscDelayMaxSec: 4,
      beepVolume: 0.9,
      flashEnabled: true,
      vibrationEnabled: true,
      micPreset: 'handgun',
      micSensitivity: 0.55,
      reducedMotion: false,
    });
    expect(ordered.ipscDelayMaxSec).toBe(4);
    expect(parseRunSearchParams('drillId=bill-drill-6&input=dryTap').ok).toBe(true);
  });

  it('maps sessions and drills', () => {
    const session: Session = {
      id: 's1',
      createdAt: 10,
      drillId: drillId('bill-drill-6'),
      timerProfile: 'ipscRandomStart',
      inputMethod: 'dryTap',
      shots: [
        { index: shotIndex(1), time: timeSec(1), split: null, inWindow: true, targetIndex: 0 },
        { index: shotIndex(2), time: timeSec(1.3), split: timeSec(0.3) as never, inWindow: true, targetIndex: 0, exposureIndex: 0 },
      ],
      firstShotSec: timeSec(1),
      totalSec: timeSec(1.3),
      settingsSnapshot: { sensitivity: 0.5, preset: 'handgun' },
    };
    const record = sessionToRecord(session);
    const roundtrip = sessionFromRecord(record);
    expect(roundtrip.shots[1]?.exposureIndex).toBe(0);
    expect(parseSessionRecord(record).ok).toBe(true);
    expect(parseSessionRecord({}).ok).toBe(false);
    const nullTimes = sessionFromRecord({ ...record, firstShotSec: null, totalSec: null });
    expect(nullTimes.firstShotSec).toBeNull();
    expect(parseDrillDefinition(getDrill('draw')).ok).toBe(true);
    expect(parseDrillDefinition({}).ok).toBe(false);
  });
});
