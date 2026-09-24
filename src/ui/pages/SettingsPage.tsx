import { LOCALES, type Locale } from '../../domain/settings/settings.ts';
import { useI18n, useSettings } from '../../app/AppProviders.tsx';
import type { TranslationKey } from '../../i18n/index.ts';
import { MicSensitivityField } from '../components/MicSensitivityField.tsx';
import { sliderFillStyle } from '../components/sliderStyle.ts';
import { Field } from '../components/Field.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';

export function SettingsPage() {
  const { t } = useI18n();
  const { settings, save } = useSettings();

  return (
    <Page title={t('settings.title')}>
      <Field label={t('settings.language')}>
        <select
          className={styles.input}
          data-testid="language"
          value={settings.locale}
          onChange={(event) => void save({ ...settings, locale: event.target.value as Locale })}
        >
          {LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {t(`lang.${locale}` as TranslationKey)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('settings.volume')}>
        <input
          className={styles.slider}
          type="range"
          style={sliderFillStyle(settings.beepVolume * 100)}
          min={0}
          max={1}
          step={0.05}
          value={settings.beepVolume}
          onChange={(event) => void save({ ...settings, beepVolume: Number(event.target.value) })}
        />
      </Field>
      <label className={styles.check}>
        <input
          type="checkbox"
          data-testid="voice-enabled"
          checked={settings.voiceEnabled}
          onChange={(event) => void save({ ...settings, voiceEnabled: event.target.checked })}
        />
        {t('settings.voice')}
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={settings.flashEnabled}
          onChange={(event) => void save({ ...settings, flashEnabled: event.target.checked })}
        />
        {t('settings.flash')}
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={settings.vibrationEnabled}
          onChange={(event) => void save({ ...settings, vibrationEnabled: event.target.checked })}
        />
        {t('settings.vibration')}
      </label>
      <MicSensitivityField inputTestId="mic-sensitivity" />
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(event) => void save({ ...settings, reducedMotion: event.target.checked })}
        />
        {t('settings.motion')}
      </label>
      <p className={styles.muted} data-testid="mic-status">
        {t('settings.mic')}: {settings.micGranted ? t('settings.micGranted') : t('settings.micDenied')}
      </p>
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>{t('install.title')}</h2>
        <p>{t('install.ios')}</p>
        <p>{t('install.android')}</p>
      </section>
    </Page>
  );
}
