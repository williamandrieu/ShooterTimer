export const DB_NAME = 'shooter-timer';
export const DB_VERSION = 1;
export const SESSIONS_STORE = 'sessions';

export function migrate(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1 && !db.objectStoreNames.contains(SESSIONS_STORE)) {
    db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
  }
}

export function openDatabase(indexedDBRef: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDBRef.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      migrate(db, event.oldVersion);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('idb open failed'));
  });
}
