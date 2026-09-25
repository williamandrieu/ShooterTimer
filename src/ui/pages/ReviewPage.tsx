import { useNavigate } from 'react-router-dom';
import { useDeps, useI18n, useRunMemory, useSettings } from '../../app/AppProviders.tsx';
import { timerStateToSession } from '../../hooks/saveRun.ts';
import { computeReviewStats } from '../../domain/review/stats.ts';
import { formatTime, type TranslationKey } from '../../i18n/index.ts';
import { shotIndex } from '../../domain/value-objects/ids.ts';
import { continueRunHref } from '../../domain/settings/settings.ts';
import { getDrill } from '../../domain/drills/catalog.ts';
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
        <p className={styles.muted}>{t('review.empty')}</p>
        <Button to="/">{t('error.home')}</Button>
      </Page>
    );
  }

  const stats = computeReviewStats(lastRun);
  const drill = getDrill(lastRun.drillId);

  return (
    <Page title={drill ? t(drill.titleKey as TranslationKey) : t('review.title')}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('review.first')}</span>
          <span className={styles.statValue}>{stats.firstShot === null ? '—' : formatTime(stats.firstShot, locale)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('review.total')}</span>
          <span className={styles.statValue}>{stats.total === null ? '—' : formatTime(stats.total, locale)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('review.avgSplit')}</span>
          <span className={styles.statValue}>
            {stats.splitAverage === null ? '—' : formatTime(stats.splitAverage, locale)}
          </span>
        </div>
      </div>
      <p className={styles.muted}>{t('review.deleteShot')}</p>
      <ul className={styles.list}>
        {lastRun.shots.map((shot) => (
          <li key={shot.index} className={styles.shotRow}>
            <span>
              {shot.index}: {formatTime(shot.time, locale)}
              {stats.showWindowFlags && !shot.inWindow ? ` ${t('review.outOfWindow')}` : ''}
            </span>
            <Button
              className={styles.btnCompact}
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
              {t('history.delete')}
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
      <Button variant="secondary" to={continueRunHref(lastRun.drillId, lastRun.inputMethod)} data-testid="back-to-drill">
        {t('review.back')}
      </Button>
    </Page>
  );
}
