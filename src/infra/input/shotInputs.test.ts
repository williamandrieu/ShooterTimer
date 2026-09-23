import { describe, expect, it } from 'vitest';
import { ManualShotInput, NoShotInput } from './shotInputs.ts';
import { timeSec } from '../../domain/value-objects/ids.ts';

describe('shot inputs', () => {
  it('no-ops and manual emit', () => {
    const none = new NoShotInput();
    none.start();
    none.mute(1);
    const unsub = none.subscribe(() => undefined);
    unsub();
    none.stop();
    const manual = new ManualShotInput();
    let seen = 0;
    const off = manual.subscribe(() => {
      seen += 1;
    });
    manual.start();
    manual.mute(1);
    manual.emit(timeSec(1));
    expect(seen).toBe(1);
    off();
    manual.emit(timeSec(2));
    expect(seen).toBe(1);
    manual.stop();
    manual.emit(timeSec(3));
    expect(seen).toBe(1);
  });
});
