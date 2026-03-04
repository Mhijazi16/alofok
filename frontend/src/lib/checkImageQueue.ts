/**
 * IndexedDB-backed offline storage for check image blobs.
 * Stores images captured while offline in the check_images store.
 * When connectivity resumes, blobs are uploaded and replaced with server URLs.
 *
 * NOTE: Intentionally does NOT import from syncQueue.ts to avoid circular deps.
 * Both modules open the same DB (alofok_offline, VERSION 2) and must stay in sync.
 */

const DB_NAME = "alofok_offline";
const STORE = "sync_queue";
const IMAGE_STORE = "check_images";
const VERSION = 2;

export interface CheckImageItem {
  id?: number;
  blob: Blob;
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
      console.warn("[checkImageQueue] IndexedDB upgrade blocked — close other tabs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function pushImage(blob: Blob): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const item: CheckImageItem = { blob, created_at: new Date().toISOString() };
    const req = tx.objectStore(IMAGE_STORE).add(item);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

async function getImage(id: number): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readonly");
    const req = tx.objectStore(IMAGE_STORE).get(id);
    req.onsuccess = () => {
      const item = req.result as CheckImageItem | undefined;
      resolve(item?.blob ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function removeImage(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const req = tx.objectStore(IMAGE_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export const checkImageQueue = { pushImage, getImage, removeImage };
