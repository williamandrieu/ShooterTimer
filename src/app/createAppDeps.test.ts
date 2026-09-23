import { describe, expect, it } from 'vitest';
import { createAppDeps, requireDeps } from './createAppDeps.ts';
import { DEFAULT_SETTINGS } from '../domain/settings/settings.ts';
import { LiveShotInput } from '../infra/audio/audioService.ts';

describe('createAppDeps', () => {
  it('builds deps and requireDeps', () => {
    const deps = createAppDeps();
    expect(requireDeps(deps).clock).toBe(deps.clock);
    expect(() => requireDeps(undefined)).toThrow();
    const shot = deps.createShotInput('dryTap', DEFAULT_SETTINGS);
    expect(shot).toBeInstanceOf(LiveShotInput);
    expect(deps.createShotInput('live', DEFAULT_SETTINGS)).toBeInstanceOf(LiveShotInput);
  });
});
