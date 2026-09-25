import { useI18n } from '../../app/AppProviders.tsx';
import { Button } from '../components/Button.tsx';
import { Page } from '../components/Page.tsx';

export function CrashPage() {
  const { t } = useI18n();
  return (
    <Page title={t('crash.title')}>
      <Button to="/">{t('error.home')}</Button>
    </Page>
  );
}
