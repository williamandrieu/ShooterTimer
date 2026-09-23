import { AppErrorCode, appError } from '../../domain/errors.ts';
import { err, ok, type Result } from '../../domain/result.ts';
import type { Session } from '../../domain/session/session.ts';
import type { SessionRepository } from '../../ports/contracts.ts';
import { parseSessionRecord, sessionToRecord } from '../../validation/schemas.ts';
import { openDatabase, SESSIONS_STORE } from './migrate.ts';

export function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('idb request failed'));
  });
}

export function createIndexedDbSessionRepository(
  indexedDBRef: IDBFactory = indexedDB,
): SessionRepository {
  const open = () => openDatabase(indexedDBRef);

  return {
    async save(session: Session): Promise<Result<void>> {
      try {
        const db = await open();
        const tx = db.transaction(SESSIONS_STORE, 'readwrite');
        await asPromise(tx.objectStore(SESSIONS_STORE).put(sessionToRecord(session)));
        db.close();
        return ok(undefined);
      } catch (cause) {
        return err(appError(AppErrorCode.IDB_WRITE, 'Could not save session', cause));
      }
    },
    async get(id: string): Promise<Result<Session | null>> {
      try {
        const db = await open();
        const tx = db.transaction(SESSIONS_STORE, 'readonly');
        const raw = await asPromise(tx.objectStore(SESSIONS_STORE).get(id));
        db.close();
        if (raw === undefined) {
          return ok(null);
        }
        return parseSessionRecord(raw);
      } catch (cause) {
        return err(appError(AppErrorCode.IDB_READ, 'Could not read session', cause));
      }
    },
    async list(): Promise<Result<Session[]>> {
      try {
        const db = await open();
        const tx = db.transaction(SESSIONS_STORE, 'readonly');
        const raw = await asPromise(tx.objectStore(SESSIONS_STORE).getAll());
        db.close();
        const sessions: Session[] = [];
        for (const item of raw) {
          const parsed = parseSessionRecord(item);
          if (parsed.ok) {
            sessions.push(parsed.value);
          }
        }
        sessions.sort((a, b) => b.createdAt - a.createdAt);
        return ok(sessions);
      } catch (cause) {
        return err(appError(AppErrorCode.IDB_READ, 'Could not list sessions', cause));
      }
    },
    async delete(id: string): Promise<Result<void>> {
      try {
        const db = await open();
        const tx = db.transaction(SESSIONS_STORE, 'readwrite');
        await asPromise(tx.objectStore(SESSIONS_STORE).delete(id));
        db.close();
        return ok(undefined);
      } catch (cause) {
        return err(appError(AppErrorCode.IDB_WRITE, 'Could not delete session', cause));
      }
    },
  };
}
