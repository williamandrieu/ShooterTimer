import type { Result } from '../../domain/result.ts';
import { ok } from '../../domain/result.ts';
import type { Settings } from '../../domain/settings/settings.ts';
import { DEFAULT_SETTINGS } from '../../domain/settings/settings.ts';
import type { SettingsRepository } from '../../ports/contracts.ts';
import { parseSettings } from '../../validation/schemas.ts';

export const SETTINGS_KEY = 'shooter-timer.settings';

export function createLocalStorageSettingsRepository(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): SettingsRepository {
  const store = storage === undefined ? globalThis.localStorage : storage;
  return {
    async load(): Promise<Settings> {
      if (!store) {
        return DEFAULT_SETTINGS;
      }
      const raw = store.getItem(SETTINGS_KEY);
      if (!raw) {
        return DEFAULT_SETTINGS;
      }
      try {
        return parseSettings(JSON.parse(raw));
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
    async save(settings: Settings): Promise<Result<void>> {
      store?.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return ok(undefined);
    },
  };
}
