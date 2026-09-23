import { describe, expect, it } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettingsLoader } from './useSettingsLoader.ts';
import { useTimerRun } from './useTimerRun.ts';
import { errorMessageKey } from './errorMessage.ts';
import { timerStateToSession } from './saveRun.ts';
import { MemorySettings } from '../test/fakes.ts';
import { createTestDeps } from '../test/createTestDeps.ts';
import { DEFAULT_SETTINGS } from '../domain/settings/settings.ts';
import { AppErrorCode } from '../domain/errors.ts';
import { drillId } from '../domain/value-objects/ids.ts';

describe('errorMessageKey', () => {
  it('maps known codes', () => {
    expect(errorMessageKey(AppErrorCode.MIC_DENIED)).toBe('error.mic');
    expect(errorMessageKey(AppErrorCode.NO_PAR_WINDOW)).toBe('error.noPar');
    expect(errorMessageKey(AppErrorCode.INVALID_RUN_CONFIG)).toBe('error.invalidRun');
    expect(errorMessageKey('OTHER')).toBe('error.generic');
    expect(typeof timerStateToSession).toBe('function');
  });
});

describe('useSettingsLoader', () => {
  it('loads and saves', async () => {
    const repo = new MemorySettings();
    const hook = renderHook(() => useSettingsLoader(repo));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    await act(async () => {
      await hook.result.current.save({ ...DEFAULT_SETTINGS, locale: 'fr' });
    });
    expect(hook.result.current.settings.locale).toBe('fr');
    hook.unmount();
  });

  it('ignores a load that finishes after unmount', async () => {
    let resolveLoad: (settings: typeof DEFAULT_SETTINGS) => void = () => undefined;
    const repo = {
      load: () =>
        new Promise<typeof DEFAULT_SETTINGS>((resolve) => {
          resolveLoad = resolve;
        }),
      save: async () => ({ ok: true as const, value: undefined }),
    };
    const hook = renderHook(() => useSettingsLoader(repo));
    hook.unmount();
    resolveLoad(DEFAULT_SETTINGS);
    await act(async () => {
      await Promise.resolve();
    });
  });
});

describe('useTimerRun', () => {
  it('runs bill drill taps to review', async () => {
    const deps = createTestDeps();
    const settings = { ...DEFAULT_SETTINGS, ipscDelayMinSec: 0.05, ipscDelayMaxSec: 0.05 };
    const hook = renderHook(() =>
      useTimerRun(
        { drillId: drillId('bill-drill-6'), inputMethod: 'dryTap' },
        deps,
        settings,
        () => undefined,
        () => undefined,
      ),
    );
    await act(async () => {
      await hook.result.current.start();
    });
    act(() => {
      deps.clock.advance(80);
    });
    for (let i = 0; i < 6; i += 1) {
      act(() => {
        deps.clock.advance(30);
        deps.shots.emit(deps.clock.now());
      });
    }
    expect(hook.result.current.state.phase).toBe('review');
    hook.unmount();
  });

  it('handles a missing drill without starting', async () => {
    const deps = createTestDeps();
    const hook = renderHook(() =>
      useTimerRun(
        { drillId: drillId('no-such'), inputMethod: 'live' },
        deps,
        DEFAULT_SETTINGS,
        () => undefined,
        () => undefined,
      ),
    );
    expect(hook.result.current.missingDrill).toBe(true);
    await act(async () => {
      await hook.result.current.start();
    });
    hook.unmount();
  });

  it('surfaces PAR errors and visibility handlers', async () => {
    const deps = createTestDeps();
    const hook = renderHook(() =>
      useTimerRun(
        { drillId: drillId('free-timer'), inputMethod: 'dryPar' },
        deps,
        DEFAULT_SETTINGS,
        () => undefined,
        () => undefined,
      ),
    );
    await act(async () => {
      await hook.result.current.start();
    });
    expect(hook.result.current.error).toBe('error.noPar');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      hook.result.current.stop();
      hook.result.current.deleteShot(1 as never);
    });
    hook.unmount();
  });

  it('records dryParTap shots', async () => {
    const deps = createTestDeps();
    const settings = { ...DEFAULT_SETTINGS, ipscDelayMinSec: 0, ipscDelayMaxSec: 0 };
    const hook = renderHook(() =>
      useTimerRun(
        { drillId: drillId('custom-par'), inputMethod: 'dryParTap' },
        deps,
        settings,
        () => undefined,
        () => undefined,
      ),
    );
    await act(async () => {
      await hook.result.current.start();
    });
    act(() => {
      deps.clock.advance(20);
      deps.shots.emit(deps.clock.now());
    });
    expect(hook.result.current.state.shots.length).toBeGreaterThan(0);
    hook.unmount();
  });

  it('still starts after settings change while waiting for the mic', async () => {
    const deps = createTestDeps();
    let release: () => void = () => undefined;
    deps.shots.holdStart = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hook = renderHook(
      ({ settings }) =>
        useTimerRun(
          { drillId: drillId('free-timer'), inputMethod: 'dryTap' },
          deps,
          settings,
          () => undefined,
          () => undefined,
        ),
      { initialProps: { settings: { ...DEFAULT_SETTINGS, ipscDelayMinSec: 0, ipscDelayMaxSec: 0 } } },
    );
    let started: Promise<void> | undefined;
    act(() => {
      started = hook.result.current.start();
    });
    hook.rerender({ settings: { ...DEFAULT_SETTINGS, ipscDelayMinSec: 0, ipscDelayMaxSec: 0, beepVolume: 0.2 } });
    release();
    await act(async () => {
      await started;
    });
    expect(hook.result.current.state.phase).not.toBe('idle');
    hook.unmount();
  });

  it('ignores a second start while the first is in flight', async () => {
    const deps = createTestDeps();
    let release: () => void = () => undefined;
    deps.shots.holdStart = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hook = renderHook(() =>
      useTimerRun(
        { drillId: drillId('free-timer'), inputMethod: 'dryTap' },
        deps,
        { ...DEFAULT_SETTINGS, ipscDelayMinSec: 0, ipscDelayMaxSec: 0 },
        () => undefined,
        () => undefined,
      ),
    );
    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    act(() => {
      first = hook.result.current.start();
      second = hook.result.current.start();
    });
    release();
    await act(async () => {
      await first;
      await second;
    });
    expect(deps.shots.started).toBe(true);
    hook.unmount();
  });
});
