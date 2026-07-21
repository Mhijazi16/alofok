import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { syncQueue, type QueueItem } from "@/lib/syncQueue";
import { checkImageQueue } from "@/lib/checkImageQueue";
import { newClientId } from "@/lib/offlineDB";
import { salesApi, type OrderCreate, type PaymentCreate, type PurchaseCreate, type CheckData, type DiscountCreate, type SettlementCreate } from "@/services/salesApi";

/**
 * Extended payment payload shape used internally when an image was captured offline.
 * pending_image_id references a blob stored in the check_images IndexedDB store.
 */
interface OfflinePaymentPayload extends PaymentCreate {
  pending_image_id?: number;
}

// ---------------------------------------------------------------------------
// Retry / backoff tuning
// ---------------------------------------------------------------------------

/** Transient failures beyond this move the item to the dead-letter state. */
const MAX_ATTEMPTS = 5;
/** Base backoff (ms) — doubled each retry, capped at BACKOFF_CAP_MS. */
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_CAP_MS = 5 * 60_000;
/** Periodic drain interval — catches queues left over from a crashed session. */
const FLUSH_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Cross-instance lock
//
// useOfflineSync is mounted independently in several role roots and flows, so
// without a guard multiple flush loops would race the same queue (double-sending
// items). This module-level flag lets only ONE flush run at a time across every
// hook instance; concurrent flush() calls become no-ops.
// ---------------------------------------------------------------------------

let flushInFlight = false;

type FailureOutcome = { stop: boolean };

/**
 * Classify a replay failure and mutate the item's retry bookkeeping in place.
 * Returns whether the whole flush loop should stop (network is down — retry the
 * entire queue later) rather than continue to the next item.
 */
function applyFailure(item: QueueItem, err: unknown): FailureOutcome {
  const isAxios = axios.isAxiosError(err);
  const status = isAxios ? err.response?.status : undefined;
  const hasResponse = isAxios && !!err.response;

  item.lastError =
    (isAxios && (err.response?.data as { detail?: string })?.detail) ||
    (err instanceof Error ? err.message : String(err));

  // Permanent client/validation error (4xx) the server will always reject —
  // dead-letter immediately, do not waste retries. 408/429 are retryable.
  if (status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    item.deadLetter = true;
    return { stop: false };
  }

  // No HTTP response and the browser is offline → connectivity is down. Stop the
  // whole flush and retry later; do NOT burn a retry (it's not the item's fault).
  if (!hasResponse && !navigator.onLine) {
    return { stop: true };
  }

  // Transient: 5xx, 408, 429, or server unreachable while nominally online.
  item.retryCount = (item.retryCount ?? 0) + 1;
  if (item.retryCount >= MAX_ATTEMPTS) {
    item.deadLetter = true;
    return { stop: false };
  }
  const backoff = Math.min(BACKOFF_BASE_MS * 2 ** (item.retryCount - 1), BACKOFF_CAP_MS);
  item.nextAttemptAt = Date.now() + backoff;
  return { stop: false };
}

/** Replay a single queued mutation, replaying its stable idempotency key. */
async function replayItem(item: QueueItem): Promise<void> {
  const key = item.idempotencyKey;

  if (item.type === "order") {
    await salesApi.createOrder(item.payload as OrderCreate, key);
    return;
  }
  if (item.type === "purchase") {
    await salesApi.createPurchase(item.payload as PurchaseCreate, key);
    return;
  }
  if (item.type === "discount") {
    await salesApi.createDiscount(item.payload as DiscountCreate, key);
    return;
  }
  if (item.type === "settlement") {
    await salesApi.createSettlement(item.payload as SettlementCreate, key);
    return;
  }

  // Payment — may carry a pending image blob captured offline.
  const payload = item.payload as OfflinePaymentPayload;
  let finalPayload: PaymentCreate = payload;

  if (payload.pending_image_id !== undefined) {
    const blob = await checkImageQueue.getImage(payload.pending_image_id);
    if (blob) {
      try {
        const { url } = await salesApi.uploadCheckImage(blob);
        const { pending_image_id: _id, ...rest } = payload;
        void _id;
        finalPayload = {
          ...rest,
          data: { ...(rest.data as CheckData | undefined), image_url: url },
        };
        await checkImageQueue.removeImage(payload.pending_image_id);
      } catch {
        // Image upload failed — submit payment without image (non-fatal).
        console.warn(
          "[useOfflineSync] Image upload failed for pending_image_id",
          payload.pending_image_id,
          "— submitting payment without image_url"
        );
        const { pending_image_id: _id, ...rest } = payload;
        void _id;
        finalPayload = rest;
      }
    } else {
      // Blob already removed (duplicate flush) — proceed without image.
      const { pending_image_id: _id, ...rest } = payload;
      void _id;
      finalPayload = rest;
    }
  }

  await salesApi.createPayment(finalPayload, key);
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [deadLetterCount, setDeadLetterCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const [pending, dead] = await Promise.all([
      syncQueue.count(),
      syncQueue.deadLetterCount(),
    ]);
    setPendingCount(pending);
    setDeadLetterCount(dead);
  }, []);

  const flush = useCallback(async () => {
    // Single-owner guard + cheap no-op when offline.
    if (flushInFlight || !navigator.onLine) return;

    const items = await syncQueue.all();
    const active = items.filter((it) => !it.deadLetter);
    if (active.length === 0) {
      await refreshCount();
      return;
    }

    flushInFlight = true;
    setIsSyncing(true);
    try {
      const now = Date.now();
      for (const item of active) {
        // Respect per-item backoff window.
        if (item.nextAttemptAt && item.nextAttemptAt > now) continue;

        // Back-fill idempotency key for items enqueued before this field existed.
        if (!item.idempotencyKey) {
          item.idempotencyKey = newClientId();
          item.retryCount = item.retryCount ?? 0;
          await syncQueue.update(item);
        }

        try {
          await replayItem(item);
          await syncQueue.remove(item.id!);
        } catch (err) {
          const { stop } = applyFailure(item, err);
          await syncQueue.update(item);
          // Network down — stop draining, whole queue retried on next trigger.
          if (stop) break;
        }
      }
    } finally {
      flushInFlight = false;
      setIsSyncing(false);
      await refreshCount();
    }
  }, [refreshCount]);

  // Online/offline events + flush on mount (covers a queue left by a crashed,
  // already-online session that never receives an "online" event).
  useEffect(() => {
    refreshCount();
    if (navigator.onLine) flush();

    function handleOnline() {
      setIsOnline(true);
      flush();
    }
    function handleOffline() {
      setIsOnline(false);
      refreshCount();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush, refreshCount]);

  // Periodic drain — no-op when offline, empty, or another flush holds the lock.
  useEffect(() => {
    const interval = setInterval(() => {
      flush();
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [flush]);

  return { isOnline, isSyncing, pendingCount, deadLetterCount, flush };
}
