import { DRILLS } from '../../domain/drills/catalog.ts';
import { liveFireHref } from '../../domain/settings/settings.ts';
import { useI18n, useSettings } from '../../app/AppProviders.tsx';
import type { TranslationKey } from '../../i18n/index.ts';
import { Button } from '../components/Button.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';
import { useSearchParams } from 'react-router-dom';

export function DrillsPage() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [params] = useSearchParams();
  const requested = params.get('category');
  const filtered = requested === 'ipsc' || requested === 'issf';
  const categories = (['ipsc', 'issf'] as const).filter((category) => !filtered || category === requested);
  return (
    <Page title={requested === 'ipsc' || requested === 'issf' ? t(`category.${requested}` as TranslationKey) : t('nav.drills')}>
      {categories.map((category) => (
        <section key={category} className={styles.stack}>
          {filtered ? null : <h2 className={styles.sectionTitle}>{t(`category.${category}` as TranslationKey)}</h2>}
          {DRILLS.filter((drill) => drill.category === category).map((drill) => (
            <article key={drill.id} className={styles.card}>
              <h3 className={styles.cardTitle}>{t(drill.titleKey as TranslationKey)}</h3>
              <p className={styles.muted}>{t(drill.briefKey as TranslationKey)}</p>
              {drill.id === 'custom-par' ? <p className={styles.muted}>{t('drill.customPar.hint')}</p> : null}
              <div className={styles.modeRow}>
                {drill.recommendedInput.includes('dryTap') ? (
                  <Button
                    className={styles.modeChip}
                    to={`/run?drillId=${drill.id}&input=dryTap`}
                    data-testid={`drill-${drill.id}-dryTap`}
                  >
                    {t('input.dryTap')}
                  </Button>
                ) : null}
                {drill.recommendedInput.includes('live') ? (
                  <Button
                    className={styles.modeChip}
                    variant="secondary"
                    to={liveFireHref(drill.id, settings.micGranted)}
                    data-testid={`drill-${drill.id}-live`}
                  >
                    {t('input.live')}
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ))}
    </Page>
  );
}
