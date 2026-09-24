import { useI18n } from '../../app/AppProviders.tsx';
import { Button } from '../components/Button.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';

function IconIpsc() {
  return (
    <svg className={styles.homeCategoryIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 2.2a7.8 7.8 0 1 1-7.8 7.8A7.8 7.8 0 0 1 12 4.2zm0 2.8a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 2a3 3 0 1 1-3 3 3 3 0 0 1 3-3z"
      />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconIssf() {
  return (
    <svg className={styles.homeCategoryIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        d="M12 3c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        d="M12 6.5c3 0 5.5 2.5 5.5 5.5S15 17.5 12 17.5 6.5 15 6.5 12 9 6.5 12 6.5z"
      />
      <path fill="currentColor" d="M11 10.2h2v3.6h-2z" />
    </svg>
  );
}

export function HomePage() {
  const { t } = useI18n();
  return (
    <Page title={t('app.name')}>
      <div className={styles.homeBody}>
        <p className={styles.muted}>{t('home.tagline')}</p>
        <div className={styles.homeCategories}>
          <Button className={styles.homeCategory} to="/drills?category=ipsc" data-testid="home-ipsc">
            <IconIpsc />
            <span>{t('home.ipsc')}</span>
          </Button>
          <Button
            className={styles.homeCategory}
            variant="secondary"
            to="/drills?category=issf"
            data-testid="home-issf"
          >
            <IconIssf />
            <span>{t('home.issf')}</span>
          </Button>
        </div>
      </div>
    </Page>
  );
}
