import { LOCALES, MIC_PRESETS, type Locale, type MicPreset } from '../../domain/settings/settings.ts';
import { useI18n, useSettings } from '../../app/AppProviders.tsx';
import type { TranslationKey } from '../../i18n/index.ts';
import { Field } from '../components/Field.tsx';
import { Page } from '../components/Page.tsx';
import styles from '../styles/ui.module.css';

function MicSensitivityControl() {
  const { t } = useI18n();
  const { settings, save } = useSettings();
  const percent = Math.round(settings.micSensitivity * 100);

  return (
    <Field label={`${t('settings.sensitivity')} ${percent}%`}>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={1}
        step={0.01}
        data-testid="mic-sensitivity"
        value={settings.micSensitivity}
        onChange={(event) => void save({ ...settings, micSensitivity: Number(event.target.value) })}
      />
      <div className={styles.meter} data-testid="mic-meter">
        <div className={styles.meterFill} style={{ width: `${percent}%` }} data-testid="mic-threshold" />
      </div>
      <p className={styles.muted}>{t('settings.sensitivityHint')}</p>
    </Field>
  );
}

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
      <Field label={`${t('settings.delay')} min`}>
        <input
          className={styles.input}
          type="number"
          min={0}
          step={0.1}
          data-testid="delay-min"
          value={settings.ipscDelayMinSec}
          onChange={(event) => void save({ ...settings, ipscDelayMinSec: Number(event.target.value) })}
        />
      </Field>
      <Field label={`${t('settings.delay')} max`}>
        <input
          className={styles.input}
          type="number"
          min={0}
          step={0.1}
          data-testid="delay-max"
          value={settings.ipscDelayMaxSec}
          onChange={(event) => void save({ ...settings, ipscDelayMaxSec: Number(event.target.value) })}
        />
      </Field>
      <Field label={t('settings.volume')}>
        <input
          className={styles.input}
          type="range"
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
      <Field label={t('settings.preset')}>
        <select
          className={styles.input}
          value={settings.micPreset}
          onChange={(event) => void save({ ...settings, micPreset: event.target.value as MicPreset })}
        >
          {MIC_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {t(`preset.${preset}` as TranslationKey)}
            </option>
          ))}
        </select>
      </Field>
      <MicSensitivityControl />
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={settings.prepEnabled}
          onChange={(event) => void save({ ...settings, prepEnabled: event.target.checked })}
        />
        {t('settings.prep')}
      </label>
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
