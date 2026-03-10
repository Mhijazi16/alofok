/**
 * Cache sync hook with freshness tracking, manual sync, and auto-refresh.
 *
 * Tracks when each data category was last synced, provides a syncAll()
 * function for manual refresh, and auto-refreshes when the app comes
 * back online after being offline.
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { del } from "idb-keyval";
import { cacheProductImages, getImageCacheSize } from "@/lib/imageCache";
import { syncQueue } from "@/lib/syncQueue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncTimestamps {
  products?: string;
  customers?: string;
  orders?: string;
  statements?: string;
}

export type SyncItemStatus = "idle" | "syncing" | "done" | "error";

export interface SyncState {
  timestamps: SyncTimestamps;
  statuses: Record<keyof SyncTimestamps, SyncItemStatus>;
  pendingCount: number;
  cacheSize: number;
  isSyncing: boolean;
}

// ---------------------------------------------------------------------------
// Query key whitelist (imported by main.tsx for shouldDehydrateQuery)
// ---------------------------------------------------------------------------

export const PERSIST_QUERY_KEYS = [
  "products",
  "my-customers",
  "route-day",
  "delivery-orders",
  "statement",
  "collections",
  "my-orders-today",
] as const;

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const LS_KEY = "alofok-sync-timestamps";

function getSyncTimestamps(): SyncTimestamps {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as SyncTimestamps) : {};
  } catch {
    return {};
  }
}

function setSyncTimestamp(key: keyof SyncTimestamps): void {
  const ts = getSyncTimestamps();
  ts[key] = new Date().toISOString();
  localStorage.setItem(LS_KEY, JSON.stringify(ts));
}

// ---------------------------------------------------------------------------
// Mapping: data category -> query keys to invalidate
// ---------------------------------------------------------------------------

const CATEGORY_KEYS: Record<keyof SyncTimestamps, string[]> = {
  products: ["products"],
  customers: ["my-customers", "route-day"],
  orders: ["delivery-orders", "my-orders-today", "collections"],
  statements: ["statement"],
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCacheSync() {
  const queryClient = useQueryClient();
  const isSyncingRef = useRef(false);

  const [statuses, setStatuses] = useState<
    Record<keyof SyncTimestamps, SyncItemStatus>
  >({
    products: "idle",
    customers: "idle",
    orders: "idle",
    statements: "idle",
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [cacheSize, setCacheSize] = useState(0);
  const [timestamps, setTimestamps] = useState<SyncTimestamps>(
    getSyncTimestamps
  );

  // -----------------------------------------------------------------------
  // syncAll
  // -----------------------------------------------------------------------

  const syncAll = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    // Clear persisted IndexedDB cache so stale data isn't restored on reload.
    // Only when online — offline mode keeps cached data intact.
    if (navigator.onLine) {
      await del("alofok-rq-cache").catch(() => {});
    }

    const categories = Object.keys(CATEGORY_KEYS) as (keyof SyncTimestamps)[];

    for (const category of categories) {
      try {
        setStatuses((prev) => ({ ...prev, [category]: "syncing" }));

        // Invalidate all query keys for this category
        await Promise.all(
          CATEGORY_KEYS[category].map((qk) =>
            queryClient.invalidateQueries({ queryKey: [qk] })
          )
        );

        setSyncTimestamp(category);
        setStatuses((prev) => ({ ...prev, [category]: "done" }));

        // For products, also cache images after invalidation
        if (category === "products") {
          try {
            const products = queryClient.getQueryData<
              Array<{ image_urls?: string[] | null }>
            >(["products"]);
            if (products) {
              const allUrls = products.flatMap((p) => p.image_urls ?? []);
              if (allUrls.length > 0) {
                await cacheProductImages(allUrls);
              }
            }
          } catch (imgErr) {
            console.warn("[useCacheSync] Image caching failed:", imgErr);
          }
        }
      } catch (err) {
        setStatuses((prev) => ({ ...prev, [category]: "error" }));
        console.warn(`[useCacheSync] Failed to sync ${category}:`, err);
      }
    }

    // Update metadata
    try {
      const [imgSize, pending] = await Promise.all([
        getImageCacheSize(),
        syncQueue.count(),
      ]);
      setCacheSize(imgSize);
      setPendingCount(pending);
    } catch {
      // Non-critical
    }

    setTimestamps(getSyncTimestamps());
    setIsSyncing(false);
    isSyncingRef.current = false;
  }, [queryClient]);

  // -----------------------------------------------------------------------
  // Auto-refresh on online event
  // -----------------------------------------------------------------------

  useEffect(() => {
    const handleOnline = () => {
      syncAll();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncAll]);

  // -----------------------------------------------------------------------
  // Auto-refresh on mount (if online)
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (navigator.onLine) {
      syncAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Periodic pendingCount refresh (every 30s)
  // -----------------------------------------------------------------------

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const count = await syncQueue.count();
        setPendingCount(count);
      } catch {
        // Non-critical
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  const syncState: SyncState = {
    timestamps,
    statuses,
    pendingCount,
    cacheSize,
    isSyncing,
  };

  return { syncState, syncAll, syncTimestamps: timestamps };
}
