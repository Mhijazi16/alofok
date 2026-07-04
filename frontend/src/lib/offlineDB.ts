/**
 * Single owner of the `alofok_offline` IndexedDB database.
 *
 * Both the write-mutation sync queue (`syncQueue.ts`) and the check-image blob
 * store (`checkImageQueue.ts`) live in the SAME database. Previously each module
 * hand-opened the DB and duplicated the schema/version — a one-sided version bump
 * would corrupt it. This module is now the ONLY place that opens the DB and owns
 * the schema/version for BOTH object stores.
 *
 * The open promise is memoized so every caller shares one connection.
 */

const DB_NAME = "alofok_offline";
// Schema version. Both object stores are created here. Bump this (and add the
// matching upgrade branch) ONLY in this file — never from the queue modules.
const VERSION = 2;

export const SYNC_STORE = "sync_queue";
export const IMAGE_STORE = "check_images";

let dbPromise: Promise<IDBDatabase> | null = null;

export function openOfflineDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Create both stores together so the schema can never be one-sided.
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onblocked = () => {
      console.warn("[offlineDB] IndexedDB upgrade blocked — close other tabs");
    };
    req.onsuccess = () => {
      const db = req.result;
      // If another tab requests a version change, close so it isn't blocked, and
      // drop the memoized promise so the next call reopens cleanly.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });

  return dbPromise;
}

/** Stable client-side id, used for idempotency keys and similar. */
export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts / very old engines.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
