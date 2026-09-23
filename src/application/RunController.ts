import { START_SIGNAL_MUTE_MS } from '../domain/audio/startSignal.ts';
import { AppErrorCode, appError } from '../domain/errors.ts';
import { err, ok, type Result } from '../domain/result.ts';
import { canStartRun } from '../domain/timer/specs.ts';
import { reduceTimerState } from '../domain/timer/reducer.ts';
import { createIdleState, type TimerState } from '../domain/timer/state.ts';
import type { TimerEvent } from '../domain/timer/events.ts';
import type { TimerProfileHandler } from '../domain/timer/profileHandlers/index.ts';
import type { Drill, InputMethod } from '../domain/drills/types.ts';
import { clampDelayRange, type Settings } from '../domain/settings/settings.ts';
import { timeSec, type ShotIndex } from '../domain/value-objects/ids.ts';
import type {
  ClockPort,
  Logger,
  RandomPort,
  RunEffects,
  ShotInputPort,
  TargetSequencePort,
} from '../ports/contracts.ts';

export type RunControllerOptions = {
  drill: Drill;
  inputMethod: InputMethod;
  parSecondsOverride?: number;
  settings: Settings;
  clock: ClockPort;
  random: RandomPort;
  shotInput: ShotInputPort;
  effects: RunEffects;
  logger: Logger;
  handler: TimerProfileHandler;
  targets: TargetSequencePort;
};

export class RunController {
  private state: TimerState;
  private readonly listeners = new Set<(state: TimerState) => void>();
  private shotUnsub: (() => void) | undefined;
  private readonly timeoutIds: number[] = [];
  private intervalId: number | undefined;
  private disposed = false;
  private starting = false;
  private settings: Settings;
  private readonly options: RunControllerOptions;

  constructor(options: RunControllerOptions) {
    this.options = options;
    this.settings = options.settings;
    this.state = createIdleState(options.drill, options.inputMethod, options.parSecondsOverride);
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
  }

  getState(): TimerState {
    return this.state;
  }

  subscribe(listener: (state: TimerState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async start(): Promise<Result<void>> {
    const allowed = canStartRun(
      this.options.drill,
      this.options.inputMethod,
      this.options.parSecondsOverride,
    );
    if (!allowed.ok) {
      return allowed;
    }
    if (this.disposed || this.starting) {
      return ok(undefined);
    }
    if (this.state.phase !== 'idle' && this.state.phase !== 'review') {
      return ok(undefined);
    }
    this.starting = true;
    try {
      try {
        await this.options.shotInput.start();
      } catch (cause) {
        this.options.shotInput.stop();
        return err(appError(AppErrorCode.MIC_DENIED, 'Microphone permission denied', cause));
      }
      if (this.disposed) {
        this.options.shotInput.stop();
        return ok(undefined);
      }
      try {
        await this.options.effects.acquireWakeLock();
      } catch (cause) {
        this.options.logger.warn('wake lock failed', cause);
      }
      this.shotUnsub?.();
      this.shotUnsub = this.options.shotInput.subscribe((at) => {
        this.dispatch({
          type: 'SHOT_RECORDED',
          at,
          targetIndex: this.options.targets.assignShotToTarget(this.state.shots.length + 1),
        });
      });
      const range = clampDelayRange(this.settings.ipscDelayMinSec, this.settings.ipscDelayMaxSec);
      const delay =
        this.state.profile === 'ipscRandomStart' ? this.options.random.between(range.min, range.max) : 0;
      this.dispatch({ type: 'ARM', at: this.options.clock.now(), delaySec: timeSec(delay) });
      this.startTicks();
      return ok(undefined);
    } finally {
      this.starting = false;
    }
  }

  stop(): void {
    this.dispatch({ type: 'STOP_REQUESTED', at: this.options.clock.now() });
  }

  deleteShot(index: ShotIndex): void {
    this.dispatch({ type: 'DELETE_SHOT', index });
  }

  handleVisibility(hidden: boolean): void {
    this.dispatch({
      type: hidden ? 'VISIBILITY_HIDDEN' : 'VISIBILITY_VISIBLE',
      at: this.options.clock.now(),
    });
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
    this.shotUnsub?.();
    this.options.shotInput.stop();
    void this.options.effects.releaseWakeLock();
  }

  private dispatch(event: TimerEvent): void {
    if (this.disposed) {
      return;
    }
    if (event.type === 'VISIBILITY_HIDDEN') {
      this.clearScheduled();
    }
    this.state = reduceTimerState(this.state, event);
    if (event.type === 'START_BEEP') {
      this.options.shotInput.mute(START_SIGNAL_MUTE_MS);
      this.options.effects.playBeep(this.settings.beepVolume);
      if (this.settings.flashEnabled && !this.settings.reducedMotion) {
        this.options.effects.flash();
      }
      if (this.settings.vibrationEnabled) {
        this.options.effects.vibrate();
      }
    }
    if (this.state.phase === 'review') {
      this.clearTimers();
      this.options.shotInput.stop();
      void this.options.effects.releaseWakeLock();
    } else if (event.type !== 'TICK') {
      this.queueSchedules(event);
    }
    this.emit();
  }

  private queueSchedules(event: TimerEvent): void {
    this.clearScheduled();
    const now = this.options.clock.now();
    for (const schedule of this.options.handler.schedulesAfter(this.state, event, now)) {
      if (schedule.delayMs <= 0) {
        this.dispatch(schedule.event);
      } else {
        const id = this.options.clock.setTimeout(() => {
          this.dispatch(schedule.event);
        }, schedule.delayMs);
        this.timeoutIds.push(id);
      }
    }
  }

  private startTicks(): void {
    this.clearInterval();
    this.intervalId = this.options.clock.setInterval(() => {
      this.dispatch({ type: 'TICK', at: this.options.clock.now() });
    }, 50);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private clearScheduled(): void {
    for (const id of this.timeoutIds) {
      this.options.clock.clearTimeout(id);
    }
    this.timeoutIds.length = 0;
  }

  private clearInterval(): void {
    if (this.intervalId !== undefined) {
      this.options.clock.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private clearTimers(): void {
    this.clearScheduled();
    this.clearInterval();
  }
}
