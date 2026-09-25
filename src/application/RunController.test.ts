import { describe, expect, it } from 'vitest';
import { RunController } from './RunController.ts';
import { getDrill } from '../domain/drills/catalog.ts';
import { shotIndex } from '../domain/value-objects/ids.ts';
import {
  CaptureLogger,
  FakeClock,
  MemorySessions,
  RecordingEffects,
  SeededRandom,
  SequentialIds,
  ScriptedShotInput,
} from '../test/fakes.ts';
import {
  ipscRandomStartHandler,
  issfCombinedHandler,
  issfExposureSequenceHandler,
  issfParCountdownHandler,
} from '../domain/timer/profileHandlers/index.ts';
import { SingleWindowTargetSequence } from '../domain/drills/targetSequence.ts';
import { DEFAULT_SETTINGS } from '../domain/settings/settings.ts';
import { createIdleState } from '../domain/timer/state.ts';
import { deleteSession, getSession, listSessions, saveSession, timerStateToSession } from './sessions.ts';
import { requestMicrophone, queryMicrophonePermission } from './requestMic.ts';
import { AppErrorCode } from '../domain/errors.ts';
import { CUE_MUTE_MS } from '../domain/audio/startSignal.ts';

function makeController(
  drillId: string,
  input: 'live' | 'dryTap' | 'dryPar' | 'dryParTap' = 'dryTap',
  extras: { failLock?: boolean; failMic?: boolean; flash?: boolean; vibrate?: boolean; motion?: boolean } = {},
) {
  const clock = new FakeClock();
  const shots = new ScriptedShotInput();
  shots.failStart = extras.failMic ?? false;
  const effects = new RecordingEffects();
  effects.failLock = extras.failLock ?? false;
  const controller = new RunController({
    drill: getDrill(drillId)!,
    inputMethod: input,
    settings: {
      ...DEFAULT_SETTINGS,
      ipscDelayMinSec: 0.2,
      ipscDelayMaxSec: 0.2,
      flashEnabled: extras.flash ?? true,
      vibrationEnabled: extras.vibrate ?? true,
      reducedMotion: extras.motion ?? false,
    },
    clock,
    random: new SeededRandom(3),
    shotInput: shots,
    effects,
    logger: new CaptureLogger(),
    handler:
      getDrill(drillId)!.timerProfile === 'issfExposureSequence'
        ? issfExposureSequenceHandler
        : getDrill(drillId)!.timerProfile === 'issfCombined'
          ? issfCombinedHandler
          : getDrill(drillId)!.timerProfile === 'issfParCountdown'
            ? issfParCountdownHandler
            : ipscRandomStartHandler,
    targets: new SingleWindowTargetSequence(),
  });
  return { controller, clock, shots, effects };
}

describe('RunController', () => {
  it('runs a dry Bill Drill to review', async () => {
    const { controller, clock, shots } = makeController('bill-drill-6');
    const states: string[] = [];
    controller.subscribe((state) => states.push(state.phase));
    const started = await controller.start();
    expect(started.ok).toBe(true);
    clock.advance(250);
    expect(controller.getState().phase).toBe('running');
    for (let i = 0; i < 6; i += 1) {
      clock.advance(50);
      shots.emit(clock.now());
    }
    expect(controller.getState().phase).toBe('review');
    controller.deleteShot(shotIndex(1));
    expect(controller.getState().shots).toHaveLength(5);
    controller.dispose();
    controller.stop();
  });

  it('records live shots and handles pause', async () => {
    const { controller, clock, shots } = makeController('free-timer', 'live');
    await controller.start();
    clock.advance(250);
    shots.emit(clock.now());
    expect(controller.getState().shots).toHaveLength(1);
    controller.handleVisibility(true);
    expect(controller.getState().phase).toBe('paused');
    controller.handleVisibility(false);
    controller.stop();
    expect(controller.getState().phase).toBe('review');
  });

  it('returns mic errors and logs wake-lock failures', async () => {
    const live = makeController('free-timer', 'live', { failMic: true, failLock: true });
    const result = await live.controller.start();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(AppErrorCode.MIC_DENIED);
    }
    expect(live.shots.stopCount).toBeGreaterThan(0);
    const dry = makeController('free-timer', 'dryTap', { failMic: true });
    const dryDenied = await dry.controller.start();
    expect(dryDenied.ok).toBe(false);
    const lockOnly = makeController('free-timer', 'dryTap', { failLock: true });
    expect((await lockOnly.controller.start()).ok).toBe(true);
  });

  it('skips flash/vibrate when disabled and runs ISSF PAR', async () => {
    const { controller, clock, effects } = makeController('std-pistol-10', 'dryPar', {
      flash: false,
      vibrate: false,
      motion: true,
    });
    await controller.start();
    clock.advance(50);
    expect(effects.flashes).toBe(0);
    expect(effects.vibrates).toBe(0);
    clock.advance(18_000);
    expect(controller.getState().phase).toBe('review');
  });

  it('rejects PAR on free timer', async () => {
    const { controller } = makeController('free-timer', 'dryPar');
    const result = await controller.start();
    expect(result.ok).toBe(false);
  });

  it('starts the mic before wake lock and ignores overlapping starts', async () => {
    const { controller, clock, shots } = makeController('free-timer');
    let release: () => void = () => undefined;
    shots.holdStart = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = controller.start();
    const second = controller.start();
    release();
    expect((await first).ok).toBe(true);
    const overlapped = await second;
    expect(overlapped.ok).toBe(false);
    if (!overlapped.ok) {
      expect(overlapped.error.code).toBe(AppErrorCode.START_SKIPPED);
    }
    clock.advance(250);
    expect(controller.getState().phase).toBe('running');
    controller.dispose();
    const afterDispose = await controller.start();
    expect(afterDispose.ok).toBe(false);
    if (!afterDispose.ok) {
      expect(afterDispose.error.code).toBe(AppErrorCode.START_DISPOSED);
    }
    expect(controller.getState().phase).toBe('running');
    const held = makeController('draw');
    held.controller.applySettings({ ...DEFAULT_SETTINGS, ipscDelayMinSec: 0, ipscDelayMaxSec: 0 });
    let releaseHeld: () => void = () => undefined;
    held.shots.holdStart = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
    const pending = held.controller.start();
    held.controller.dispose();
    releaseHeld();
    const abandoned = await pending;
    expect(abandoned.ok).toBe(false);
    if (!abandoned.ok) {
      expect(abandoned.error.code).toBe(AppErrorCode.START_DISPOSED);
    }
    expect(held.controller.getState().phase).toBe('idle');
  });

  it('records dryParTap shots, flashes, and restarts safely', async () => {
    const { controller, clock, effects, shots } = makeController('custom-par', 'dryParTap');
    const unsub = controller.subscribe(() => undefined);
    unsub();
    await controller.start();
    await controller.start();
    clock.advance(250);
    expect(effects.flashes).toBeGreaterThan(0);
    expect(effects.vibrates).toBeGreaterThan(0);
    shots.emit(clock.now());
    expect(controller.getState().shots).toHaveLength(1);
    controller.dispose();
  });

  it('beeps and lights each face and edge of a 3-7 string', async () => {
    const { controller, clock, shots, effects } = makeController('fftir-3-7', 'dryTap');
    await controller.start();
    clock.advance(6_900);
    expect(controller.getState().phase).toBe('prep');
    expect(controller.getState().light).toBe('red');
    expect(effects.beeps).toBe(0);
    expect(effects.cues).toEqual([]);
    clock.advance(200);
    expect(controller.getState().exposureOpen).toBe(true);
    expect(controller.getState().light).toBe('green');
    expect(effects.cues).toEqual(['face']);
    expect(effects.flashes).toBe(0);
    clock.advance(3_000);
    expect(controller.getState().light).toBe('red');
    expect(controller.getState().exposureOpen).toBe(false);
    expect(effects.cues).toEqual(['face', 'edge']);
    expect(shots.mutes).toEqual([CUE_MUTE_MS, CUE_MUTE_MS]);
  });

  it('runs an ISSF exposure sequence to review', async () => {
    const { controller, clock } = makeController('sport-rapid-3x5', 'dryTap');
    await controller.start();
    clock.advance(3_100);
    expect(controller.getState().phase).toBe('prep');
    expect(controller.getState().exposureOpen).toBe(false);
    clock.advance(24_000);
    expect(controller.getState().phase).toBe('review');
  });
});

describe('session use cases', () => {
  it('saves lists and deletes', async () => {
    const repo = new MemorySessions();
    const ids = new SequentialIds();
    const { controller, clock, shots } = makeController('draw');
    await controller.start();
    clock.advance(300);
    shots.emit(clock.now());
    const empty = timerStateToSession(createIdleState(getDrill('draw')!, 'dryTap'), ids, 1, DEFAULT_SETTINGS);
    expect(empty.totalSec).toBe(0);
    const session = timerStateToSession(controller.getState(), ids, 1, DEFAULT_SETTINGS);
    expect((await saveSession(repo, session)).ok).toBe(true);
    expect((await listSessions(repo)).value?.length).toBe(1);
    expect((await getSession(repo, session.id)).value?.id).toBe(session.id);
    expect((await deleteSession(repo, session.id)).ok).toBe(true);
    expect((await getSession(repo, session.id)).value).toBeNull();
  });
});

describe('requestMicrophone', () => {
  it('stops tracks on success and maps denial', async () => {
    const okResult = await requestMicrophone(async () => ({
      getTracks: () => [{ stop: () => undefined }],
    }) as unknown as MediaStream);
    expect(okResult.ok).toBe(true);
    const denied = await requestMicrophone(async () => {
      throw new Error('no');
    });
    expect(denied.ok).toBe(false);
  });
});

describe('queryMicrophonePermission', () => {
  it('normalizes states and catches failures', async () => {
    expect(await queryMicrophonePermission(async () => 'granted')).toBe('granted');
    expect(await queryMicrophonePermission(async () => 'denied')).toBe('denied');
    expect(await queryMicrophonePermission(async () => 'prompt')).toBe('prompt');
    expect(await queryMicrophonePermission(async () => 'maybe')).toBe('unknown');
    expect(
      await queryMicrophonePermission(async () => {
        throw new Error('no api');
      }),
    ).toBe('unknown');
  });
});
