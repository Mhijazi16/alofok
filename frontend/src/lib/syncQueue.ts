/**
 * IndexedDB-backed offline sync queue.
 * Orders and payments created while offline are pushed here,
 * then drained automatically when connectivity resumes.
 */

const DB_NAME = "alofok_offline";
const STORE = "sync_queue";
const VERSION = 2;
export const IMAGE_STORE = "check_images";

export interface QueueItem {
  id?: number;
  type: "order" | "payment" | "purchase";
  payload: unknown;
  created_at: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onblocked = () => {
      console.warn("[syncQueue] IndexedDB upgrade blocked — close other tabs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function push(type: "order" | "payment" | "purchase", payload: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const item: QueueItem = { type, payload, created_at: new Date().toISOString() };
    const req = tx.objectStore(STORE).add(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function all(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueueItem[]);
    req.onerror = () => reject(req.error);
  });
}

async function remove(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function count(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export const syncQueue = { push, all, remove, count };
