import { useEffect, useState } from 'react';
import { useDeps, useI18n } from '../../app/AppProviders.tsx';
import type { Session } from '../../domain/session/session.ts';
import { getDrill } from '../../domain/drills/catalog.ts';
import { formatTime } from '../../i18n/index.ts';
import type { TranslationKey } from '../../i18n/index.ts';
import { Button } from '../components/Button.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';

export function HistoryPage() {
  const { t, locale } = useI18n();
  const deps = useDeps();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    void deps.sessions.list().then((result) => {
      if (result.ok) {
        setSessions(result.value);
      }
    });
  }, [deps]);

  return (
    <Page title={t('history.title')}>
      {sessions.length === 0 ? <p className={styles.muted}>{t('history.empty')}</p> : null}
      <ul className={styles.list}>
        {sessions.map((session) => {
          const drill = getDrill(session.drillId);
          const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
            session.createdAt,
          );
          return (
            <li key={session.id} className={styles.card} data-testid="history-item">
              <strong>{drill ? t(drill.titleKey as TranslationKey) : session.drillId}</strong>
              <div className={styles.muted}>
                {when} · {t(`input.${session.inputMethod}` as TranslationKey)}
              </div>
              <div>
                {session.shots.length} · {session.totalSec === null ? '—' : formatTime(session.totalSec, locale)}
              </div>
              <Button
                className={styles.btnCompact}
                variant="secondary"
                onClick={() => {
                  void deps.sessions.delete(session.id).then(() => {
                    setSessions((current) => current.filter((item) => item.id !== session.id));
                  });
                }}
              >
                {t('history.delete')}
              </Button>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
