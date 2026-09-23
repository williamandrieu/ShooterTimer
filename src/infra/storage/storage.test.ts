import { describe, expect, it } from 'vitest';
import { migrate, openDatabase, SESSIONS_STORE } from './migrate.ts';
import { asPromise, createIndexedDbSessionRepository } from './sessionRepository.ts';
import { createLocalStorageSettingsRepository, SETTINGS_KEY } from './settingsRepository.ts';
import { drillId, shotIndex, timeSec } from '../../domain/value-objects/ids.ts';
import type { Session } from '../../domain/session/session.ts';
import { DEFAULT_SETTINGS } from '../../domain/settings/settings.ts';

const session: Session = {
  id: 'abc',
  createdAt: 5,
  drillId: drillId('draw'),
  timerProfile: 'ipscRandomStart',
  inputMethod: 'dryTap',
  shots: [{ index: shotIndex(1), time: timeSec(1), split: null, inWindow: true, targetIndex: 0 }],
  firstShotSec: timeSec(1),
  totalSec: timeSec(1),
  settingsSnapshot: { sensitivity: 0.4, preset: 'indoor' },
};

describe('indexeddb sessions', () => {
  it('migrates and performs CRUD', async () => {
    const fakeDb = {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => undefined,
    } as unknown as IDBDatabase;
    migrate(fakeDb, 0);
    const existing = {
      objectStoreNames: { contains: () => true },
      createObjectStore: () => {
        throw new Error('should not create');
      },
    } as unknown as IDBDatabase;
    migrate(existing, 0);
    migrate(existing, 1);

    const repo = createIndexedDbSessionRepository();
    expect((await repo.save(session)).ok).toBe(true);
    expect((await repo.get('abc')).value?.id).toBe('abc');
    expect((await repo.get('missing')).value).toBeNull();
    expect((await repo.list()).value?.[0]?.id).toBe('abc');
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      const req = tx.objectStore(SESSIONS_STORE).put({ id: 'junk' });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
    const listed = await repo.list();
    expect(listed.ok).toBe(true);
    expect(listed.value?.some((item) => item.id === 'junk')).toBe(false);
    expect((await repo.get('junk')).ok).toBe(false);
    await repo.save({ ...session, id: 'bad-to-skip' });
    expect((await repo.delete('abc')).ok).toBe(true);
    expect((await repo.save({ ...session, id: 'abc2', createdAt: 1 })).ok).toBe(true);
    expect((await repo.save({ ...session, id: 'abc3', createdAt: 9 })).ok).toBe(true);
    const ordered = await repo.list();
    expect(ordered.value?.[0]?.id).toBe('abc3');
    await openDatabase();
  });

  it('maps idb failures', async () => {
    const broken = {
      open: () => {
        throw new Error('nope');
      },
    } as unknown as IDBFactory;
    const repo = createIndexedDbSessionRepository(broken);
    expect((await repo.save(session)).ok).toBe(false);
    expect((await repo.get('x')).ok).toBe(false);
    expect((await repo.list()).ok).toBe(false);
    expect((await repo.delete('x')).ok).toBe(false);
  });
});

describe('settings localStorage', () => {
  it('loads defaults and persisted values', async () => {
    const mem = {
      data: {} as Record<string, string>,
      getItem(key: string) {
        return this.data[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.data[key] = value;
      },
    };
    const repo = createLocalStorageSettingsRepository(mem);
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
    await repo.save({ ...DEFAULT_SETTINGS, locale: 'pl' });
    expect(mem.data[SETTINGS_KEY]).toContain('pl');
    expect((await repo.load()).locale).toBe('pl');
    mem.data[SETTINGS_KEY] = '{not json';
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
    const none = createLocalStorageSettingsRepository(null);
    expect(await none.load()).toEqual(DEFAULT_SETTINGS);
    expect((await none.save(DEFAULT_SETTINGS)).ok).toBe(true);
    const browser = createLocalStorageSettingsRepository();
    expect((await browser.save({ ...DEFAULT_SETTINGS, locale: 'fr' })).ok).toBe(true);
    expect((await browser.load()).locale).toBe('fr');
  });
});

describe('openDatabase error path', () => {
  it('rejects when open fails', async () => {
    const indexedDBRef = {
      open: () => {
        const request: {
          onerror: ((ev: unknown) => void) | null;
          onsuccess: ((ev: unknown) => void) | null;
          onupgradeneeded: ((ev: unknown) => void) | null;
          result: unknown;
          error: Error;
        } = {
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
          result: null,
          error: new Error('fail'),
        };
        queueMicrotask(() => request.onerror?.(null));
        return request;
      },
    } as unknown as IDBFactory;
    await expect(openDatabase(indexedDBRef)).rejects.toBeTruthy();

    const noError = {
      open: () => {
        const request: {
          onerror: ((ev: unknown) => void) | null;
          onsuccess: ((ev: unknown) => void) | null;
          onupgradeneeded: ((ev: unknown) => void) | null;
          result: unknown;
          error: Error | null;
        } = {
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
          result: null,
          error: null,
        };
        queueMicrotask(() => request.onerror?.(null));
        return request;
      },
    } as unknown as IDBFactory;
    await expect(openDatabase(noError)).rejects.toBeTruthy();
  });

  it('maps request success and error', async () => {
    const okReq = {
      result: 7,
      error: null,
      onsuccess: null as ((ev: unknown) => void) | null,
      onerror: null as ((ev: unknown) => void) | null,
    };
    const okPromise = asPromise(okReq as unknown as IDBRequest<number>);
    okReq.onsuccess?.(null);
    expect(await okPromise).toBe(7);

    const failReq = {
      result: undefined,
      error: new Error('real'),
      onsuccess: null as ((ev: unknown) => void) | null,
      onerror: null as ((ev: unknown) => void) | null,
    };
    const failPromise = asPromise(failReq as unknown as IDBRequest<number>);
    failReq.onerror?.(null);
    await expect(failPromise).rejects.toBe(failReq.error);

    const missingErr = {
      result: undefined,
      error: null,
      onsuccess: null as ((ev: unknown) => void) | null,
      onerror: null as ((ev: unknown) => void) | null,
    };
    const missingPromise = asPromise(missingErr as unknown as IDBRequest<number>);
    missingErr.onerror?.(null);
    await expect(missingPromise).rejects.toBeTruthy();
  });
});
