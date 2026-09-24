export type Locale = 'fr' | 'en' | 'pl';

export const LOCALES: readonly Locale[] = ['fr', 'en', 'pl'];

export type MicPreset = 'indoor' | 'outdoor' | 'rimfire' | 'handgun';

export const MIC_PRESETS: readonly MicPreset[] = ['indoor', 'outdoor', 'rimfire', 'handgun'];

export type Settings = {
  locale: Locale;
  ipscDelayMinSec: number;
  ipscDelayMaxSec: number;
  beepVolume: number;
  flashEnabled: boolean;
  vibrationEnabled: boolean;
  micPreset: MicPreset;
  micSensitivity: number;
  reducedMotion: boolean;
  micGranted: boolean;
  voiceEnabled: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  locale: 'en',
  ipscDelayMinSec: 1,
  ipscDelayMaxSec: 4,
  beepVolume: 0.9,
  flashEnabled: true,
  vibrationEnabled: true,
  micPreset: 'handgun',
  micSensitivity: 0.55,
  reducedMotion: false,
  micGranted: false,
  voiceEnabled: true,
};

export function mergeSettings(partial: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

export function resolveLocale(language: string): Locale {
  const lower = language.toLowerCase();
  if (lower.startsWith('fr')) {
    return 'fr';
  }
  if (lower.startsWith('pl')) {
    return 'pl';
  }
  return 'en';
}

export function clampDelayRange(minSec: number, maxSec: number): { min: number; max: number } {
  const min = Math.max(0, minSec);
  const max = Math.max(min, maxSec);
  return { min, max };
}

export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export function normalizeMicPermissionState(state: string): MicPermissionState {
  if (state === 'granted' || state === 'denied' || state === 'prompt') {
    return state;
  }
  return 'unknown';
}

export function reconcileMicGranted(stored: boolean, queried: MicPermissionState): boolean {
  if (queried === 'granted') {
    return true;
  }
  if (queried === 'denied') {
    return false;
  }
  return stored;
}

export function withMicPermission(settings: Settings, queried: MicPermissionState): Settings {
  const micGranted = reconcileMicGranted(settings.micGranted, queried);
  if (micGranted === settings.micGranted) {
    return settings;
  }
  return { ...settings, micGranted };
}

export function continueRunHref(drillId: string, inputMethod: string): string {
  return `/run?drillId=${encodeURIComponent(drillId)}&input=${encodeURIComponent(inputMethod)}`;
}

export function liveFireHref(drillId: string, micGranted: boolean): string {
  const query = `drillId=${encodeURIComponent(drillId)}&input=live`;
  return micGranted ? `/run?${query}` : `/preflight?${query}`;
}
