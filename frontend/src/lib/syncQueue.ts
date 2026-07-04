/**
 * IndexedDB-backed offline sync queue.
 * Orders, payments, purchases and discounts created while offline are pushed
 * here, then drained automatically when connectivity resumes.
 *
 * The DB connection/schema is owned by `offlineDB.ts` (shared with the
 * check-image store) so the two modules can never bump the version out of sync.
 *
 * Reliability fields carried on each item:
 *  - `idempotencyKey` — stable UUID generated at enqueue time, replayed with the
 *    mutation so a request that succeeded server-side before the client could
 *    remove it is de-duplicated on the next flush (backend must honor it).
 *  - `retryCount` / `lastError` — retry bookkeeping for transient failures.
 *  - `nextAttemptAt` — epoch ms before which the item is skipped (backoff).
 *  - `deadLetter` — set once an item is permanently rejected (4xx) or exceeds the
 *    max retry threshold, so it stops blocking the queue and can be surfaced.
 */

import { openOfflineDB, SYNC_STORE, IMAGE_STORE, newClientId } from "./offlineDB";

const STORE = SYNC_STORE;
export { IMAGE_STORE };

export interface QueueItem {
  id?: number;
  type: "order" | "payment" | "purchase" | "discount";
  payload: unknown;
  created_at: string;
  /** Stable idempotency key, generated at enqueue time; never changes on retry. */
  idempotencyKey: string;
  /** Number of transient failures so far. */
  retryCount: number;
  /** Last error message, for surfacing/debugging. */
  lastError?: string;
  /** Epoch ms; item is skipped while Date.now() < nextAttemptAt (backoff). */
  nextAttemptAt?: number;
  /** Permanently failed — no longer retried, kept for user visibility. */
  deadLetter?: boolean;
}

async function push(
  type: QueueItem["type"],
  payload: unknown,
  // Optional caller-supplied stable key. Lets a batch reuse one key per logical
  // item so re-enqueuing after a partial failure is deduped by the backend
  // instead of creating duplicates. Defaults to a fresh id.
  idempotencyKey: string = newClientId()
): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const item: QueueItem = {
      type,
      payload,
      created_at: new Date().toISOString(),
      idempotencyKey,
      retryCount: 0,
    };
    const req = tx.objectStore(STORE).add(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function all(): Promise<QueueItem[]> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueueItem[]);
    req.onerror = () => reject(req.error);
  });
}

/** Persist mutated retry/dead-letter bookkeeping back onto an existing item. */
async function update(item: QueueItem): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function remove(id: number): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Count of active (non-dead-letter) pending items. */
async function count(): Promise<number> {
  const items = await all();
  return items.filter((it) => !it.deadLetter).length;
}

/** Count of permanently-failed items awaiting user attention. */
async function deadLetterCount(): Promise<number> {
  const items = await all();
  return items.filter((it) => it.deadLetter).length;
}

export const syncQueue = { push, all, update, remove, count, deadLetterCount };
