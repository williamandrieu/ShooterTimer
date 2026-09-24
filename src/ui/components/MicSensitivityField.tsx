import { useI18n, useSettings } from '../../app/AppProviders.tsx';
import { Field } from './Field.tsx';
import styles from '../styles/ui.module.css';

export function MicSensitivityField({
  inputTestId,
  labelKey = 'settings.sensitivity',
  large = false,
  ends = false,
}: {
  inputTestId: string;
  labelKey?: 'settings.sensitivity' | 'run.sensitivity';
  large?: boolean;
  ends?: boolean;
}) {
  const { t } = useI18n();
  const { settings, save } = useSettings();
  const percent = Math.round(settings.micSensitivity * 100);

  return (
    <Field label={`${t(labelKey)} ${percent}%`}>
      {ends ? (
        <div className={styles.sensitivityEnds}>
          <span>{t('run.sensitivityLow')}</span>
          <span>{t('run.sensitivityHigh')}</span>
        </div>
      ) : null}
      <input
        className={large ? styles.sliderLarge : styles.slider}
        type="range"
        min={0}
        max={1}
        step={0.01}
        data-testid={inputTestId}
        value={settings.micSensitivity}
        style={{ '--slider-fill': `${percent}%` }}
        onChange={(event) => void save({ ...settings, micSensitivity: Number(event.target.value) })}
      />
      <p className={styles.muted}>{t('settings.sensitivityHint')}</p>
    </Field>
  );
}
