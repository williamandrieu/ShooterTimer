import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Locale, Settings } from '../domain/settings/settings.ts';
import { DEFAULT_SETTINGS, resolveLocale, withMicPermission } from '../domain/settings/settings.ts';
import { pickMessages, t, type Messages, type TranslationKey } from '../i18n/index.ts';
import type { AppDeps } from './createAppDeps.ts';
import type { TimerState } from '../domain/timer/state.ts';

export const DepsContext = createContext<AppDeps | undefined>(undefined);

export function useDeps(): AppDeps {
  const deps = useContext(DepsContext);
  if (!deps) {
    throw new Error('App deps missing');
  }
  return deps;
}

export const I18nContext = createContext<{
  locale: Locale;
  messages: Messages;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
} | undefined>(undefined);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('I18n missing');
  }
  return ctx;
}

export const SettingsContext = createContext<{
  settings: Settings;
  save: (next: Settings) => Promise<void>;
} | undefined>(undefined);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('Settings missing');
  }
  return ctx;
}

export const RunMemoryContext = createContext<{
  lastRun: TimerState | null;
  setLastRun: (state: TimerState | null) => void;
} | undefined>(undefined);

export function useRunMemory() {
  const ctx = useContext(RunMemoryContext);
  if (!ctx) {
    throw new Error('Run memory missing');
  }
  return ctx;
}

export function AppProviders({
  deps,
  children,
  initialLastRun = null,
}: {
  deps: AppDeps;
  children: ReactNode;
  initialLastRun?: TimerState | null;
}) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [lastRun, setLastRun] = useState<TimerState | null>(initialLastRun);

  useEffect(() => {
    void (async () => {
      const loaded = await deps.settings.load();
      const queried = await deps.queryMicPermission();
      let next = withMicPermission(loaded, queried);
      if (loaded.locale === 'en' && typeof navigator !== 'undefined') {
        const detected = resolveLocale(navigator.language);
        if (detected !== 'en') {
          next = { ...next, locale: detected };
        }
      }
      setSettings(next);
      if (next.locale !== loaded.locale || next.micGranted !== loaded.micGranted) {
        void deps.settings.save(next);
      }
    })();
  }, [deps]);

  const save = useCallback(
    async (next: Settings) => {
      setSettings(next);
      await deps.settings.save(next);
    },
    [deps],
  );

  const messages = pickMessages(settings.locale);

  return (
    <DepsContext.Provider value={deps}>
      <SettingsContext.Provider
        value={{
          settings,
          save,
        }}
      >
        <I18nContext.Provider
          value={{
            locale: settings.locale,
            messages,
            t: (key, vars) => t(messages, key, vars),
          }}
        >
          <RunMemoryContext.Provider value={{ lastRun, setLastRun }}>{children}</RunMemoryContext.Provider>
        </I18nContext.Provider>
      </SettingsContext.Provider>
    </DepsContext.Provider>
  );
}
