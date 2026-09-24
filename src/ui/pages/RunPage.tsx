import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useDeps, useI18n, useRunMemory, useSettings } from '../../app/AppProviders.tsx';
import { parseRunSearchParams } from '../../validation/schemas.ts';
import { useTimerRun } from '../../hooks/useTimerRun.ts';
import { formatTime } from '../../i18n/index.ts';
import type { RunConfig } from '../../domain/drills/types.ts';
import { MIC_PRESETS, clampDelayRange, type MicPreset, type Settings } from '../../domain/settings/settings.ts';
import type { TranslationKey } from '../../i18n/index.ts';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { MicSensitivityField } from '../components/MicSensitivityField.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';

function DelayControl() {
  const { t } = useI18n();
  const { settings, save } = useSettings();
  const random = settings.ipscDelayMinSec !== settings.ipscDelayMaxSec;
  const step = (current: number, delta: number) => Math.max(0, Math.round(current + delta));
  const write = (next: Pick<Settings, 'ipscDelayMinSec' | 'ipscDelayMaxSec'>) => {
    const range = clampDelayRange(next.ipscDelayMinSec, next.ipscDelayMaxSec);
    void save({ ...settings, ipscDelayMinSec: range.min, ipscDelayMaxSec: range.max });
  };

  return (
    <section className={styles.runPanel} data-testid="delay-control">
      <h2 className={styles.cardTitle}>{t('run.delay')}</h2>
      <p className={styles.muted}>{t('run.delayHint')}</p>
      <label className={styles.check}>
        <input
          type="checkbox"
          data-testid="delay-random"
          checked={random}
          onChange={(event) => {
            if (event.target.checked) {
              write({ ipscDelayMinSec: settings.ipscDelayMinSec, ipscDelayMaxSec: settings.ipscDelayMinSec + 1 });
            } else {
              write({ ipscDelayMinSec: settings.ipscDelayMinSec, ipscDelayMaxSec: settings.ipscDelayMinSec });
            }
          }}
        />
        {t('run.delayRandom')}
      </label>
      {random ? (
        <>
          <Stepper
            label={t('run.delayMin')}
            testId="delay-min-run"
            value={settings.ipscDelayMinSec}
            onChange={(value) => write({ ipscDelayMinSec: value, ipscDelayMaxSec: settings.ipscDelayMaxSec })}
            step={step}
          />
          <Stepper
            label={t('run.delayMax')}
            testId="delay-max-run"
            value={settings.ipscDelayMaxSec}
            onChange={(value) => write({ ipscDelayMinSec: settings.ipscDelayMinSec, ipscDelayMaxSec: value })}
            step={step}
          />
        </>
      ) : (
        <Stepper
          label={t('run.delay')}
          testId="delay-fixed"
          value={settings.ipscDelayMinSec}
          onChange={(value) => write({ ipscDelayMinSec: value, ipscDelayMaxSec: value })}
          step={step}
        />
      )}
    </section>
  );
}

function Stepper({
  label,
  testId,
  value,
  onChange,
  step,
}: {
  label: string;
  testId: string;
  value: number;
  onChange: (value: number) => void;
  step: (current: number, delta: number) => number;
}) {
  return (
    <div className={styles.stepper}>
      <span>{label}</span>
      <div className={styles.stepperRow}>
        <button
          type="button"
          className={styles.stepperBtn}
          data-testid={`${testId}-minus`}
          onClick={() => onChange(step(value, -1))}
        >
          −
        </button>
        <span className={styles.stepperValue} data-testid={testId}>
          {value}
          <span className={styles.stepperUnit}>s</span>
        </span>
        <button
          type="button"
          className={styles.stepperBtn}
          data-testid={`${testId}-plus`}
          onClick={() => onChange(step(value, 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function RunPage() {
  const [params] = useSearchParams();
  const parsed = parseRunSearchParams(params.toString());
  if (!parsed.ok) {
    return <Navigate to="/invalid" replace />;
  }
  return <LoadedRun config={parsed.value} />;
}

function LoadedRun({ config }: { config: RunConfig }) {
  const { t, locale } = useI18n();
  const deps = useDeps();
  const { settings, save } = useSettings();
  const { setLastRun } = useRunMemory();
  const navigate = useNavigate();
  const [flash, setFlash] = useState(false);

  const run = useTimerRun(
    config,
    deps,
    settings,
    () => {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 450);
    },
    (state) => {
      setLastRun(state);
      if (state.phase === 'review') {
        navigate('/review');
      }
    },
  );

  if (run.missingDrill) {
    return <Navigate to="/invalid" replace />;
  }

  const lightClass = styles[run.state.light] ?? styles.off;
  const dryFire = config.inputMethod !== 'live';

  return (
    <Page>
      <div className={flash ? 'flash on' : 'flash'} />
      {run.state.hiddenMessage ? <p>{t('run.hidden')}</p> : null}
      {run.state.phase === 'prep' ? <p>{t('run.prep')}</p> : null}
      {dryFire ? (
        <p className={styles.muted} data-testid="dry-mic-hint">
          {t('run.dryMic')}
        </p>
      ) : null}
      <div className={`${styles.light} ${lightClass}`} data-testid="light" />
      <div className={styles.time} data-testid="clock">
        {formatTime(run.state.elapsedSec, locale)}
      </div>
      <div className={styles.row}>
        <span>
          {t('run.shots')} {run.state.shots.length}
        </span>
        <span>
          {t('run.split')} {formatTime(run.state.shots[run.state.shots.length - 1]?.split ?? 0, locale)}
        </span>
      </div>
      <ul className={styles.list} aria-live="polite">
        {run.state.shots.map((shot) => (
          <li key={shot.index}>
            {shot.index}: {formatTime(shot.time, locale)}
            {shot.split !== null ? ` (+${formatTime(shot.split, locale)})` : ''}
          </li>
        ))}
      </ul>
      {run.error ? <p data-testid="run-error">{t(run.error)}</p> : null}
      {run.state.phase === 'idle' || run.state.phase === 'review' ? (
        <>
          <DelayControl />
          <section className={styles.runPanel}>
            <Field label={t('settings.preset')}>
              <select
                className={styles.input}
                data-testid="run-mic-preset"
                value={settings.micPreset}
                onChange={(event) => void save({ ...settings, micPreset: event.target.value as MicPreset })}
              >
                {MIC_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {t(`preset.${preset}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </Field>
            <MicSensitivityField inputTestId="run-sensitivity" labelKey="run.sensitivity" large ends />
          </section>
          <Button
            data-testid="start"
            disabled={!run.ready || run.starting}
            onPointerDown={() => {
              deps.audio.unlock();
              void run.start();
            }}
            onClick={(event) => {
              if (event.detail !== 0) {
                return;
              }
              deps.audio.unlock();
              void run.start();
            }}
          >
            {t('run.start')}
          </Button>
        </>
      ) : (
        <Button variant="danger" data-testid="stop" onClick={() => run.stop()}>
          {t('run.stop')}
        </Button>
      )}
    </Page>
  );
}
