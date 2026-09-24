import { describe, expect, it } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettingsLoader } from './useSettingsLoader.ts';
import { useTimerRun, announceTransition } from './useTimerRun.ts';
import { errorMessageKey } from './errorMessage.ts';
import { timerStateToSession } from './saveRun.ts';
import { MemorySettings } from '../test/fakes.ts';
import { createTestDeps } from '../test/createTestDeps.ts';
import { DEFAULT_SETTINGS } from '../domain/settings/settings.ts';
import { AppErrorCode } from '../domain/errors.ts';
import { drillId } from '../domain/value-objects/ids.ts';
import { getDrill } from '../domain/drills/catalog.ts';
import { createIdleState } from '../domain/timer/state.ts';

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

  it('arms when start is requested before the controller exists', async () => {
    const deps = createTestDeps();
    const settings = { ...DEFAULT_SETTINGS, ipscDelayMinSec: 0, ipscDelayMaxSec: 0 };
    let requested = false;
    const hook = renderHook(() => {
      const run = useTimerRun(
        { drillId: drillId('free-timer'), inputMethod: 'dryTap' },
        deps,
        settings,
        () => undefined,
        () => undefined,
      );
      if (!requested) {
        requested = true;
        void run.start();
      }
      return run;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.ready).toBe(true);
    expect(hook.result.current.state.phase).not.toBe('idle');
    hook.unmount();
  });

  it('retries on the replacement controller when start is disposed', async () => {
    const deps = createTestDeps();
    const settings = { ...DEFAULT_SETTINGS, ipscDelayMinSec: 0, ipscDelayMaxSec: 0 };
    let release: () => void = () => undefined;
    deps.shots.holdStart = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hook = renderHook(
      ({ id }) =>
        useTimerRun(
          { drillId: drillId(id), inputMethod: 'dryTap' },
          deps,
          settings,
          () => undefined,
          () => undefined,
        ),
      { initialProps: { id: 'free-timer' } },
    );
    let started: Promise<void> | undefined;
    act(() => {
      started = hook.result.current.start();
    });
    hook.rerender({ id: 'bill-drill-6' });
    release();
    await act(async () => {
      await started;
    });
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.state.phase).not.toBe('idle');
    hook.unmount();
  });

  it('reports a disposed start that has no replacement controller', async () => {
    const deps = createTestDeps();
    const settings = { ...DEFAULT_SETTINGS, ipscDelayMinSec: 0, ipscDelayMaxSec: 0 };
    let release: () => void = () => undefined;
    deps.shots.holdStart = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hook = renderHook(
      ({ id }) =>
        useTimerRun(
          { drillId: drillId(id), inputMethod: 'dryTap' },
          deps,
          settings,
          () => undefined,
          () => undefined,
        ),
      { initialProps: { id: 'free-timer' } },
    );
    let started: Promise<void> | undefined;
    act(() => {
      started = hook.result.current.start();
    });
    hook.rerender({ id: 'no-such' });
    release();
    await act(async () => {
      await started;
    });
    expect(hook.result.current.error).toBe('error.generic');
    expect(deps.logger.lines.some((line) => line.level === 'warn' && line.message === 'start disposed')).toBe(
      true,
    );
    hook.unmount();
  });

  it('ignores a start that finishes after unmount', async () => {
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
    act(() => {
      void hook.result.current.start();
    });
    hook.unmount();
    release();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('does not surface an error when the run is already started', async () => {
    const deps = createTestDeps();
    const settings = { ...DEFAULT_SETTINGS, ipscDelayMinSec: 0, ipscDelayMaxSec: 0 };
    const hook = renderHook(() =>
      useTimerRun(
        { drillId: drillId('free-timer'), inputMethod: 'dryTap' },
        deps,
        settings,
        () => undefined,
        () => undefined,
      ),
    );
    await act(async () => {
      await hook.result.current.start();
    });
    await act(async () => {
      await hook.result.current.start();
    });
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.state.phase).not.toBe('idle');
    hook.unmount();
  });
});

describe('announceTransition', () => {
  it('speaks ISSF prep, attention and series numbers', () => {
    const spoken: string[] = [];
    const speech = { speak: (text: string) => spoken.push(text) };
    const idle = createIdleState(getDrill('std-pistol-20')!, 'dryPar');
    const prep = { ...idle, phase: 'prep' as const };
    const running = { ...prep, phase: 'running' as const };
    const series = { ...running, exposureOpen: true, currentExposureIndex: 0 };
    announceTransition(speech, DEFAULT_SETTINGS, 'issf', idle, prep);
    announceTransition(speech, DEFAULT_SETTINGS, 'issf', prep, running);
    announceTransition(speech, DEFAULT_SETTINGS, 'issf', running, series);
    announceTransition(speech, { ...DEFAULT_SETTINGS, voiceEnabled: false }, 'issf', idle, prep);
    announceTransition(speech, DEFAULT_SETTINGS, 'ipsc', idle, prep);
    expect(spoken).toEqual(['Preparation', 'Attention', 'Series 1']);
  });
});
