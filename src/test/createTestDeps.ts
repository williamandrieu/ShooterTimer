import { SingleWindowTargetSequence } from '../domain/drills/targetSequence.ts';
import { defaultProfileRegistry } from '../domain/timer/profileHandlers/index.ts';
import type { AppDeps } from '../app/createAppDeps.ts';
import { BrowserAudioService, BrowserRunEffects, BrowserWakeLock } from '../infra/audio/audioService.ts';
import { requestMicrophone } from '../application/requestMic.ts';
import {
  CaptureLogger,
  FakeClock,
  MemorySessions,
  MemorySettings,
  RecordingEffects,
  ScriptedShotInput,
  SeededRandom,
  SequentialIds,
} from './fakes.ts';
import { ok } from '../domain/result.ts';

export function createTestDeps(overrides: Partial<AppDeps> = {}): AppDeps & {
  clock: FakeClock;
  logger: CaptureLogger;
  sessions: MemorySessions;
  settingsStore: MemorySettings;
  shots: ScriptedShotInput;
} {
  const clock = new FakeClock();
  const logger = new CaptureLogger();
  const sessions = new MemorySessions();
  const settingsStore = new MemorySettings();
  const effects = new RecordingEffects();
  const shots = new ScriptedShotInput();
  const deps: AppDeps = {
    clock,
    random: new SeededRandom(1),
    ids: new SequentialIds(),
    logger,
    sessions,
    settings: settingsStore,
    targets: new SingleWindowTargetSequence(),
    profiles: defaultProfileRegistry,
    audio: overrides.audio ?? new BrowserAudioService(),
    createShotInput: () => shots,
    createEffects: (onFlash) =>
      ({
        playBeep: () => effects.playBeep(),
        flash: () => {
          effects.flash();
          onFlash();
        },
        vibrate: () => effects.vibrate(),
        acquireWakeLock: () => effects.acquireWakeLock(),
        releaseWakeLock: () => effects.releaseWakeLock(),
      }) as BrowserRunEffects,
    requestMic: async () => requestMicrophone(async () => ({ getTracks: () => [] }) as unknown as MediaStream),
    queryMicPermission: async () => 'prompt',
    speech: { speak: () => undefined },
    ...overrides,
  };
  return Object.assign(deps, { clock, logger, sessions, settingsStore, effects, shots });
}

export { ok, BrowserWakeLock };
