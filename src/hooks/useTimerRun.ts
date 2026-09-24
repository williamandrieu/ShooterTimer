import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RunController } from '../application/RunController.ts';
import { getDrill } from '../domain/drills/catalog.ts';
import { AppErrorCode } from '../domain/errors.ts';
import type { Result } from '../domain/result.ts';
import type { InputMethod, RunConfig } from '../domain/drills/types.ts';
import type { Settings } from '../domain/settings/settings.ts';
import { createIdleState, type TimerState } from '../domain/timer/state.ts';
import type { ShotIndex } from '../domain/value-objects/ids.ts';
import type { AppDeps } from '../app/createAppDeps.ts';
import { errorMessageKey } from './errorMessage.ts';
import { pickMessages, t } from '../i18n/index.ts';
import type { TranslationKey } from '../i18n/index.ts';
import type { SpeechPort } from '../ports/contracts.ts';

export function resolveRunDrill(config: RunConfig) {
  return getDrill(config.drillId);
}

export function announceTransition(
  speech: SpeechPort,
  settings: Settings,
  category: string | undefined,
  previous: TimerState,
  next: TimerState,
): void {
  if (!settings.voiceEnabled || category !== 'issf') {
    return;
  }
  const say = (key: TranslationKey, vars?: Record<string, string>) => {
    speech.speak(t(pickMessages(settings.locale), key, vars), settings.locale);
  };
  if (next.phase === 'prep' && previous.phase !== 'prep') {
    say('voice.prep');
  }
  if (next.phase === 'running' && (previous.phase === 'armed' || previous.phase === 'prep')) {
    say('voice.attention');
  }
  if (
    next.exposureOpen &&
    next.currentExposureIndex !== null &&
    next.currentExposureIndex !== previous.currentExposureIndex
  ) {
    say('voice.series', { n: String(next.currentExposureIndex + 1) });
  }
}

export function useTimerRun(
  config: RunConfig,
  deps: AppDeps,
  settings: Settings,
  onFlash: () => void,
  onFinish: (state: TimerState) => void,
) {
  const drill = resolveRunDrill(config);
  const [state, setState] = useState<TimerState>(() =>
    drill
      ? createIdleState(drill, config.inputMethod, config.parSecondsOverride)
      : createIdleState(
          {
            id: config.drillId,
            category: 'ipsc',
            timerProfile: 'ipscRandomStart',
            expectedShots: null,
            recommendedInput: ['live'],
            titleKey: 'drill.free.title',
            briefKey: 'drill.free.brief',
          },
          config.inputMethod,
        ),
  );
  const [error, setError] = useState<TranslationKey | null>(null);
  const [starting, setStarting] = useState(false);
  const [ready, setReady] = useState(false);
  const controllerRef = useRef<RunController | null>(null);
  const startingRef = useRef(false);
  const pendingStartRef = useRef(false);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const flashRef = useRef(onFlash);
  const finishRef = useRef(onFinish);
  const settingsRef = useRef(settings);
  const beginStartRef = useRef(beginStart);

  useLayoutEffect(() => {
    beginStartRef.current = beginStart;
  });

  useEffect(() => {
    flashRef.current = onFlash;
    finishRef.current = onFinish;
    settingsRef.current = settings;
  });

  useLayoutEffect(() => {
    mountedRef.current = true;
    if (!drill) {
      return () => {
        mountedRef.current = false;
      };
    }
    generationRef.current += 1;
    const inputMethod: InputMethod = config.inputMethod;
    const shotInput = deps.createShotInput(inputMethod, settingsRef.current);
    const controller = new RunController({
      drill,
      inputMethod,
      parSecondsOverride: config.parSecondsOverride,
      settings: settingsRef.current,
      clock: deps.clock,
      random: deps.random,
      shotInput,
      effects: deps.createEffects(() => flashRef.current()),
      logger: deps.logger,
      handler: deps.profiles.get(drill.timerProfile),
      targets: deps.targets,
    });
    controllerRef.current = controller;
    const previous = { current: controller.getState() };
    const unsub = controller.subscribe((next) => {
      setReady(true);
      announceTransition(deps.speech, settingsRef.current, drill.category, previous.current, next);
      previous.current = next;
      setState(next);
      if (next.phase === 'review') {
        finishRef.current(next);
      }
    });
    const onVisibility = () => {
      controller.handleVisibility(document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (pendingStartRef.current) {
      pendingStartRef.current = false;
      void beginStartRef.current();
    }
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      document.removeEventListener('visibilitychange', onVisibility);
      unsub();
      controller.dispose();
      controllerRef.current = null;
      setReady(false);
    };
  }, [config.drillId, config.inputMethod, config.parSecondsOverride, deps, drill]);

  async function drive(controller: RunController, allowRetry: boolean): Promise<void> {
    const gen = generationRef.current;
    const result = await controller.start();
    if (!mountedRef.current) {
      return;
    }
    const next = controllerRef.current;
    const disposed = !result.ok && result.error.code === AppErrorCode.START_DISPOSED;
    const stale = generationRef.current !== gen || disposed;
    if (allowRetry && stale && next) {
      await drive(next, false);
      return;
    }
    applyStartResult(result, disposed);
  }

  function applyStartResult(result: Result<void>, disposed: boolean): void {
    if (result.ok || result.error.code === AppErrorCode.START_SKIPPED) {
      return;
    }
    if (disposed) {
      deps.logger.warn('start disposed');
    }
    setError(errorMessageKey(result.error.code));
  }

  async function beginStart(): Promise<void> {
    deps.audio.unlock();
    const controller = controllerRef.current;
    if (!controller) {
      pendingStartRef.current = true;
      return;
    }
    if (startingRef.current) {
      return;
    }
    startingRef.current = true;
    setStarting(true);
    setError(null);
    try {
      await drive(controller, true);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  useEffect(() => {
    controllerRef.current?.applySettings(settings);
  }, [settings]);

  return {
    state,
    error,
    starting,
    ready,
    missingDrill: !drill,
    start: beginStart,
    stop: () => {
      controllerRef.current?.stop();
    },
    deleteShot: (index: ShotIndex) => {
      controllerRef.current?.deleteShot(index);
    },
  };
}
