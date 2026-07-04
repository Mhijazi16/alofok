/**
 * IndexedDB-backed offline storage for check image blobs.
 * Stores images captured while offline in the check_images store.
 * When connectivity resumes, blobs are uploaded and replaced with server URLs.
 *
 * The DB connection/schema is owned by `offlineDB.ts` (shared with the sync
 * queue) so both stores live under one version and can never be bumped apart.
 */

import { openOfflineDB, IMAGE_STORE } from "./offlineDB";

const STORE = IMAGE_STORE;

export interface CheckImageItem {
  id?: number;
  blob: Blob;
  created_at: string;
}

async function pushImage(blob: Blob): Promise<number> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const item: CheckImageItem = { blob, created_at: new Date().toISOString() };
    const req = tx.objectStore(STORE).add(item);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

async function getImage(id: number): Promise<Blob | null> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => {
      const item = req.result as CheckImageItem | undefined;
      resolve(item?.blob ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function removeImage(id: number): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export const checkImageQueue = { pushImage, getImage, removeImage };
