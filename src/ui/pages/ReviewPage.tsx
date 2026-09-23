import { useNavigate } from 'react-router-dom';
import { useDeps, useI18n, useRunMemory, useSettings } from '../../app/AppProviders.tsx';
import { timerStateToSession } from '../../hooks/saveRun.ts';
import { computeReviewStats } from '../../domain/review/stats.ts';
import { formatTime } from '../../i18n/index.ts';
import { shotIndex } from '../../domain/value-objects/ids.ts';
import { continueRunHref } from '../../domain/settings/settings.ts';
import { Button } from '../components/Button.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';

export function ReviewPage() {
  const { t, locale } = useI18n();
  const { lastRun, setLastRun } = useRunMemory();
  const deps = useDeps();
  const { settings } = useSettings();
  const navigate = useNavigate();

  if (!lastRun) {
    return (
      <Page>
        <p className={styles.muted}>{t('history.empty')}</p>
      </Page>
    );
  }

  const stats = computeReviewStats(lastRun);

  return (
    <Page title={t('review.title')}>
      <p>
        {t('review.first')}: {stats.firstShot === null ? '—' : formatTime(stats.firstShot, locale)}
      </p>
      <p>
        {t('review.total')}: {stats.total === null ? '—' : formatTime(stats.total, locale)}
      </p>
      <p>
        {t('review.avgSplit')}: {stats.splitAverage === null ? '—' : formatTime(stats.splitAverage, locale)}
      </p>
      <p className={styles.muted}>{t('review.deleteShot')}</p>
      <ul className={styles.list}>
        {lastRun.shots.map((shot) => (
          <li key={shot.index}>
            <Button
              variant="secondary"
              data-testid={`shot-${shot.index}`}
              onClick={() => {
                const next = {
                  ...lastRun,
                  shots: lastRun.shots.filter((item) => item.index !== shot.index),
                };
                setLastRun({
                  ...next,
                  shots: next.shots.map((item, i) => ({ ...item, index: shotIndex(i + 1) })),
                });
              }}
            >
              {shot.index}: {formatTime(shot.time, locale)}
              {stats.showWindowFlags && !shot.inWindow ? ` ${t('review.outOfWindow')}` : ''}
            </Button>
          </li>
        ))}
      </ul>
      <Button
        data-testid="save-session"
        onClick={() => {
          const session = timerStateToSession(lastRun, deps.ids, deps.clock.wallMs(), settings);
          void deps.sessions.save(session).then(() => navigate('/history'));
        }}
      >
        {t('review.save')}
      </Button>
      <Button variant="secondary" to={continueRunHref(lastRun.drillId, lastRun.inputMethod)}>
        {t('review.repeat')}
      </Button>
      <Button variant="secondary" to={continueRunHref(lastRun.drillId, lastRun.inputMethod)} data-testid="back-to-drill">
        {t('review.back')}
      </Button>
    </Page>
  );
}
