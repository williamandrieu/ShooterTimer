import { useI18n } from '../../app/AppProviders.tsx';
import { Button } from '../components/Button.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';

export function HomePage() {
  const { t } = useI18n();
  return (
    <Page title={t('app.name')}>
      <p className={styles.muted}>{t('home.tagline')}</p>
      <Button to="/run?drillId=free-timer&input=dryTap" data-testid="home-free">
        {t('home.free')}
      </Button>
      <Button variant="secondary" to="/drills">
        {t('home.drills')}
      </Button>
    </Page>
  );
}
