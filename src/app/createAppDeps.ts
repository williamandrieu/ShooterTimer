import { SingleWindowTargetSequence } from '../domain/drills/targetSequence.ts';
import { defaultProfileRegistry } from '../domain/timer/profileHandlers/index.ts';
import type {
  ClockPort,
  IdPort,
  Logger,
  RandomPort,
  SessionRepository,
  SettingsRepository,
  ShotInputPort,
  TargetSequencePort,
} from '../ports/contracts.ts';
import { requirePort } from '../ports/contracts.ts';
import { BrowserAudioService, BrowserRunEffects, BrowserWakeLock, requestMicPermission } from '../infra/audio/audioService.ts';
import { browserClock } from '../infra/browser/clock.ts';
import { consoleLogger } from '../infra/browser/logger.ts';
import { browserIds, browserRandom } from '../infra/browser/random.ts';
import { createIndexedDbSessionRepository } from '../infra/storage/sessionRepository.ts';
import { createLocalStorageSettingsRepository } from '../infra/storage/settingsRepository.ts';
import { requestMicrophone } from '../application/requestMic.ts';
import type { Result } from '../domain/result.ts';
import type { InputMethod } from '../domain/drills/types.ts';
import type { MicPermissionState, Settings } from '../domain/settings/settings.ts';
import { onsetConfigFor } from '../domain/audio/onset.ts';
import { LiveShotInput } from '../infra/audio/audioService.ts';
import { queryBrowserMicPermission } from '../infra/audio/micPermission.ts';
import workletUrl from '../infra/audio/shotDetector.worklet.ts?url';

export type AppDeps = {
  clock: ClockPort;
  random: RandomPort;
  ids: IdPort;
  logger: Logger;
  sessions: SessionRepository;
  settings: SettingsRepository;
  targets: TargetSequencePort;
  profiles: typeof defaultProfileRegistry;
  audio: BrowserAudioService;
  createShotInput: (method: InputMethod, settings: Settings) => ShotInputPort;
  createEffects: (onFlash: () => void) => BrowserRunEffects;
  requestMic: () => Promise<Result<void>>;
  queryMicPermission: () => Promise<MicPermissionState>;
};

export function createAppDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const audio = overrides.audio ?? new BrowserAudioService();
  const wake = new BrowserWakeLock();
  const deps: AppDeps = {
    clock: browserClock,
    random: browserRandom,
    ids: browserIds,
    logger: consoleLogger,
    sessions: createIndexedDbSessionRepository(),
    settings: createLocalStorageSettingsRepository(),
    targets: new SingleWindowTargetSequence(),
    profiles: defaultProfileRegistry,
    audio,
    createShotInput: (method, settings) => {
      return new LiveShotInput(
        audio,
        () => browserClock.now(),
        workletUrl,
        onsetConfigFor(method, settings.micPreset, settings.micSensitivity),
      );
    },
    createEffects: (onFlash) => new BrowserRunEffects(audio, wake, onFlash),
    requestMic: async () => {
      const result = await requestMicPermission();
      if (!result.ok) {
        return result;
      }
      return requestMicrophone(async () => result.value);
    },
    queryMicPermission: () => queryBrowserMicPermission(),
    ...overrides,
  };
  return deps;
}

export function requireDeps(deps: AppDeps | undefined): AppDeps {
  return requirePort(deps, 'AppDeps');
}
