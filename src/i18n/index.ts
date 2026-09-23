import type { Locale } from '../domain/settings/settings.ts';
import { resolveLocale } from '../domain/settings/settings.ts';
import { en, type TranslationKey } from './en.ts';
import { fr } from './fr.ts';
import { pl } from './pl.ts';

export type Messages = Record<TranslationKey, string>;

export const catalogs: Record<Locale, Messages> = { fr, en, pl };

export function pickMessages(locale: Locale): Messages {
  return catalogs[locale];
}

export function t(messages: Messages, key: TranslationKey | string, vars?: Record<string, string>): string {
  const template = isKey(key) ? messages[key] : key;
  if (!vars) {
    return template;
  }
  return Object.keys(vars).reduce((acc, name) => {
    const value = vars[name];
    if (value === undefined) {
      return acc;
    }
    return acc.replaceAll(`{${name}}`, value);
  }, template);
}

export function formatTime(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function detectLocale(language = defaultLanguage()): Locale {
  return resolveLocale(language);
}

export function defaultLanguage(): string {
  if (typeof navigator === 'undefined') {
    return 'en';
  }
  return navigator.language;
}

export function isKey(key: string): key is TranslationKey {
  return key in en;
}

export function catalogKeys(): TranslationKey[] {
  return Object.keys(en) as TranslationKey[];
}

export function missingKeys(locale: Locale): string[] {
  const messages = catalogs[locale];
  return catalogKeys().filter((key) => messages[key] === undefined);
}

export type { TranslationKey };
export { en, fr, pl };
