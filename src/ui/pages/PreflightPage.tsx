import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDeps, useI18n, useSettings } from '../../app/AppProviders.tsx';
import { Button } from '../components/Button.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';

export function PreflightPage() {
  const { t } = useI18n();
  const deps = useDeps();
  const { settings, save } = useSettings();
  const [params] = useSearchParams();
  const [denied, setDenied] = useState(false);
  const settingsRef = useRef(settings);
  const drillId = params.get('drillId') ?? 'free-timer';
  const input = params.get('input') ?? 'live';
  const granted = settings.micGranted && !denied;

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    void deps.queryMicPermission().then((state) => {
      if (cancelled) {
        return;
      }
      setDenied(state === 'denied');
    });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  return (
    <Page title={t('preflight.title')}>
      <p>{t('preflight.hint')}</p>
      {denied ? (
        <p className={styles.muted} data-testid="mic-denied">
          {t('preflight.denied')}
        </p>
      ) : null}
      {granted ? (
        <p className={styles.muted} data-testid="mic-granted">
          {t('preflight.granted')}
        </p>
      ) : null}
      <Button
        data-testid="grant-mic"
        onClick={() => {
          void deps.requestMic().then((result) => {
            setDenied(!result.ok);
            void save({ ...settingsRef.current, micGranted: result.ok });
          });
        }}
      >
        {t('preflight.grant')}
      </Button>
      <Button variant="secondary" to={`/run?drillId=${drillId}&input=${input}`}>
        {t('preflight.continue')}
      </Button>
    </Page>
  );
}
