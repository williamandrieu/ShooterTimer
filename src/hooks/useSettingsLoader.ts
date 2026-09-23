import { useEffect, useState } from 'react';
import type { Settings } from '../domain/settings/settings.ts';
import { DEFAULT_SETTINGS } from '../domain/settings/settings.ts';
import type { SettingsRepository } from '../ports/contracts.ts';

export function useSettingsLoader(repository: SettingsRepository) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void repository.load().then((loaded) => {
      if (!cancelled) {
        setSettings(loaded);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  return {
    settings,
    ready,
    save: async (next: Settings) => {
      setSettings(next);
      await repository.save(next);
    },
  };
}
