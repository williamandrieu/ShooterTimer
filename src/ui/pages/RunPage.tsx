import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useDeps, useI18n, useRunMemory, useSettings } from '../../app/AppProviders.tsx';
import { parseRunSearchParams } from '../../validation/schemas.ts';
import { useTimerRun } from '../../hooks/useTimerRun.ts';
import { formatTime } from '../../i18n/index.ts';
import type { RunConfig } from '../../domain/drills/types.ts';
import { Button } from '../components/Button.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';

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
  const { settings } = useSettings();
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
        <Button
          data-testid="start"
          disabled={run.starting}
          onPointerDown={() => deps.audio.unlock()}
          onClick={() => void run.start()}
        >
          {t('run.start')}
        </Button>
      ) : (
        <Button variant="danger" data-testid="stop" onClick={() => run.stop()}>
          {t('run.stop')}
        </Button>
      )}
    </Page>
  );
}
