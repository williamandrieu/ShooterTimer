import { useEffect, useRef, useState } from 'react';
import { RunController } from '../application/RunController.ts';
import { getDrill } from '../domain/drills/catalog.ts';
import type { InputMethod, RunConfig } from '../domain/drills/types.ts';
import type { Settings } from '../domain/settings/settings.ts';
import { createIdleState, type TimerState } from '../domain/timer/state.ts';
import type { ShotIndex } from '../domain/value-objects/ids.ts';
import type { AppDeps } from '../app/createAppDeps.ts';
import { errorMessageKey } from './errorMessage.ts';
import type { TranslationKey } from '../i18n/index.ts';

export function resolveRunDrill(config: RunConfig) {
  return getDrill(config.drillId);
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
  const controllerRef = useRef<RunController | null>(null);
  const startingRef = useRef(false);
  const flashRef = useRef(onFlash);
  const finishRef = useRef(onFinish);
  const settingsRef = useRef(settings);

  useEffect(() => {
    flashRef.current = onFlash;
    finishRef.current = onFinish;
    settingsRef.current = settings;
  });

  useEffect(() => {
    if (!drill) {
      return undefined;
    }
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
    const unsub = controller.subscribe((next) => {
      setState(next);
      if (next.phase === 'review') {
        finishRef.current(next);
      }
    });
    const onVisibility = () => {
      controller.handleVisibility(document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      unsub();
      controller.dispose();
      controllerRef.current = null;
    };
  }, [config.drillId, config.inputMethod, config.parSecondsOverride, deps, drill]);

  useEffect(() => {
    controllerRef.current?.applySettings(settings);
  }, [settings]);

  return {
    state,
    error,
    starting,
    missingDrill: !drill,
    start: async () => {
      deps.audio.unlock();
      const controller = controllerRef.current;
      if (!controller || startingRef.current) {
        return;
      }
      startingRef.current = true;
      setStarting(true);
      setError(null);
      try {
        const result = await controller.start();
        if (result && !result.ok) {
          setError(errorMessageKey(result.error.code));
        }
      } finally {
        startingRef.current = false;
        setStarting(false);
      }
    },
    stop: () => {
      controllerRef.current?.stop();
    },
    deleteShot: (index: ShotIndex) => {
      controllerRef.current?.deleteShot(index);
    },
  };
}
