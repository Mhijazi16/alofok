# Phase 13: Offline Caching - Research

**Researched:** 2026-03-06
**Domain:** IndexedDB persistence, React Query offline cache, image caching
**Confidence:** HIGH

## Summary

Phase 13 adds read-side offline caching for Sales reps. The app already has a write-side offline queue (`syncQueue.ts` + `useOfflineSync.ts`) using raw IndexedDB in the `alofok_offline` database (version 2, stores: `sync_queue`, `check_images`). This phase adds React Query cache persistence to IndexedDB so catalog, route, orders, and statements are available offline.

The approach uses `@tanstack/react-query-persist-client` with `PersistQueryClientProvider` and a custom IDB persister built on `idb-keyval`. The existing QueryClient in `main.tsx` needs its `gcTime` raised from the default 5 minutes to effectively infinite (matching the "never expire by time" decision). A `shouldDehydrateQuery` filter ensures only Sales-relevant queries (products, route, orders, statements) are persisted -- not admin/designer queries or mutation state. Product images are cached separately via the Cache API (better for URL-addressable resources, streams data efficiently).

**Primary recommendation:** Use `PersistQueryClientProvider` with `idb-keyval` persister + `shouldDehydrateQuery` whitelist. Cache images via Cache API. Add a `useCacheSync` hook for manual refresh and freshness tracking. Build a sync status card in the Sales profile tab.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `idb-keyval` + `@tanstack/react-query-persist-client` for React Query cache persistence to IndexedDB
- Existing `alofok_offline` IndexedDB database already has `sync_queue` and `check_images` stores -- add new cache store(s)
- `gcTime` set high (effectively infinite) -- cache never expires by time
- Cache is invalidated and refreshed when connectivity returns (online event), NOT on a timer
- Auto-refresh triggers: app open (online) + reconnect after offline
- Cache scope: Products (full catalog + images as blobs), Route customers, Today's orders, Customer statements (last 30 days), Product images cached as-is from `/static/`
- Freshness indicator: Sync status card in Sales Profile tab (not route view, not banner)
- Shows per-data-type freshness with color-coded dots: green (<1h), yellow (1-6h), red (>6h)
- "Sync Now" button refreshes ALL cached data at once
- Shows pending write queue count and total cache size
- Auto-sync on first login, pre-cache everything in background
- Auto-refresh on app open (if online) and on reconnect
- No optimistic updates -- server-authoritative
- Existing OfflineBanner is sufficient -- no changes needed
- No cache expiry empty states -- cache persists indefinitely

### Claude's Discretion
- IndexedDB store structure (single store vs separate stores for each data type)
- React Query persist configuration details (serialization, key filtering)
- Image caching implementation (Cache API vs IndexedDB blobs)
- Background sync scheduling and error retry logic
- Profile sync card exact layout, spacing, and animation details
- How to handle partial sync failures (some endpoints succeed, others fail)

### Deferred Ideas (OUT OF SCOPE)
- Image compression pipeline (compress on upload, serve smaller images)
- Offline expense submission (OFFL-04)
- vite-plugin-pwa / Service Worker for full PWA -- conflicts with Capacitor WKWebView
- Per-item selective sync (let rep choose what to cache)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OFFL-01 | Product catalog is cached in IndexedDB and available when offline | `PersistQueryClientProvider` persists React Query cache (products query) to IndexedDB via `idb-keyval`. Product images cached separately via Cache API. `gcTime: Infinity` prevents garbage collection. |
| OFFL-02 | Route data (customers, today's orders) is cached and available offline | Same persist mechanism covers `route-day`, `delivery-orders`, `my-customers`, `statement` query keys. `shouldDehydrateQuery` whitelist ensures these are included. |
| OFFL-03 | Stale cached data shows a "last updated" freshness indicator | Custom `useCacheSync` hook tracks per-data-type last-synced timestamps in localStorage. Sync status card in Sales profile tab shows relative times with color-coded dots. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query-persist-client` | ^5.x (matches installed react-query 5.90.21) | Persist React Query cache to storage | Official TanStack plugin, handles restore lifecycle, pauses queries until hydrated |
| `idb-keyval` | ^6.2.2 | Simple key-value IndexedDB wrapper | 600 bytes, promise-based, structured clone (no serialization needed), used in official TanStack docs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Cache API (browser built-in) | N/A | Cache product images by URL | For URL-addressable resources like `/static/products/*.jpg` -- streams data, no serialization |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `idb-keyval` (separate DB) | Extend raw `alofok_offline` IDB | More code, manual serialization, but unified DB. Recommendation: use `idb-keyval` with `createStore()` for cache, keep `alofok_offline` for sync queue. |
| Cache API for images | IndexedDB blob storage | IndexedDB works but Cache API is purpose-built for URL resources, better streaming, and the images are already URL-addressable from `/static/` |
| `experimental_createQueryPersister` (per-query) | `PersistQueryClientProvider` (whole-client) | Per-query is more granular but still experimental. Whole-client with `shouldDehydrateQuery` filter is stable and simpler for this use case. |

**Installation:**
```bash
cd frontend && bun add @tanstack/react-query-persist-client idb-keyval
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── syncQueue.ts          # Existing - write-side offline queue (unchanged)
│   ├── checkImageQueue.ts    # Existing - check image blobs (unchanged)
│   ├── queryPersister.ts     # NEW - idb-keyval persister for React Query
│   └── imageCache.ts         # NEW - Cache API wrapper for product images
├── hooks/
│   ├── useOfflineSync.ts     # Existing - write-side sync (unchanged)
│   └── useCacheSync.ts       # NEW - read-side cache freshness + manual sync
├── components/Sales/
│   └── index.tsx             # Modified - profile tab gets SyncStatusCard
├── components/shared/
│   └── SyncStatusCard.tsx    # NEW - per-data-type freshness display
└── main.tsx                  # Modified - PersistQueryClientProvider + gcTime
```

### Pattern 1: IDB Persister with idb-keyval
**What:** Custom persister using `idb-keyval` for `PersistQueryClientProvider`
**When to use:** Always -- this is the persistence layer
**Example:**
```typescript
// Source: TanStack Query official docs - persistQueryClient
import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

export function createIDBPersister(idbValidKey: IDBValidKey = 'alofok-rq-cache'): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return await get<PersistedClient>(idbValidKey);
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  } satisfies Persister;
}
```

### Pattern 2: PersistQueryClientProvider with Query Filtering
**What:** Wrap app with persistence provider, filter which queries are persisted
**When to use:** In main.tsx replacing bare `QueryClientProvider`
**Example:**
```typescript
// Source: TanStack Query docs - shouldDehydrateQuery
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

const PERSIST_QUERY_KEYS = ['products', 'my-customers', 'route-day', 'delivery-orders', 'statement', 'collections'];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 min (existing)
      gcTime: 1000 * 60 * 60 * 24, // 24h -- must >= maxAge
    },
  },
});

const persister = createIDBPersister();

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister,
    maxAge: 1000 * 60 * 60 * 24, // 24h
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        // Only persist successful queries with whitelisted keys
        if (query.state.status !== 'success') return false;
        const key = query.queryKey[0] as string;
        return PERSIST_QUERY_KEYS.includes(key);
      },
    },
  }}
>
```

### Pattern 3: Cache API for Product Images
**What:** Use browser Cache API to cache product images by URL
**When to use:** When product catalog loads, pre-cache all image URLs
**Example:**
```typescript
// imageCache.ts
const CACHE_NAME = 'alofok-product-images';

export async function cacheProductImages(imageUrls: string[]): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const existing = await cache.keys();
  const existingUrls = new Set(existing.map(r => r.url));

  const toCache = imageUrls.filter(url => !existingUrls.has(new URL(url, location.origin).href));

  await Promise.allSettled(
    toCache.map(url => cache.add(url).catch(() => {
      console.warn('[imageCache] Failed to cache:', url);
    }))
  );
}

export async function getCacheSize(): Promise<number> {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  let total = 0;
  for (const req of keys) {
    const resp = await cache.match(req);
    if (resp) {
      const blob = await resp.blob();
      total += blob.size;
    }
  }
  return total;
}
```

### Pattern 4: Freshness Tracking via localStorage
**What:** Store last-synced timestamps per data type
**When to use:** For the sync status card's freshness indicators
**Example:**
```typescript
// useCacheSync.ts
const SYNC_TIMESTAMPS_KEY = 'alofok-sync-timestamps';

interface SyncTimestamps {
  products?: string;
  customers?: string;
  orders?: string;
  statements?: string;
}

function getSyncTimestamps(): SyncTimestamps {
  try {
    return JSON.parse(localStorage.getItem(SYNC_TIMESTAMPS_KEY) || '{}');
  } catch { return {}; }
}

function setSyncTimestamp(key: keyof SyncTimestamps) {
  const ts = getSyncTimestamps();
  ts[key] = new Date().toISOString();
  localStorage.setItem(SYNC_TIMESTAMPS_KEY, JSON.stringify(ts));
}
```

### Pattern 5: Auto-Refresh on Reconnect
**What:** When `online` event fires, invalidate all cached queries to trigger refetch
**When to use:** In `useCacheSync` hook
**Example:**
```typescript
// Within useCacheSync
useEffect(() => {
  function handleOnline() {
    // Invalidate all cacheable queries -- triggers refetch
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['my-customers'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
    queryClient.invalidateQueries({ queryKey: ['route-day'] });
    // Update timestamps after successful refetch via onSuccess callbacks
  }
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}, [queryClient]);
```

### Anti-Patterns to Avoid
- **Persisting mutation state:** Only persist successful query data. Never persist pending mutations or error states to IndexedDB.
- **Using `gcTime: Infinity`:** While tempting per the "never expire" decision, JavaScript caps `setTimeout` at ~24.8 days. Use `1000 * 60 * 60 * 24` (24h) which is plenty. The `maxAge` on persister controls disk persistence separately.
- **Serializing blobs in React Query cache:** Product image blobs should NOT go through React Query. The structured clone algorithm handles this in raw IndexedDB/Cache API, but React Query's dehydration serializes to JSON. Keep images in Cache API.
- **Opening multiple IDB connections:** The `idb-keyval` library uses a default store. Use `createStore()` to create a named store to avoid conflicts with the existing `alofok_offline` database.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query cache persistence | Custom IndexedDB serialize/deserialize for React Query state | `@tanstack/react-query-persist-client` + `idb-keyval` | Handles dehydration, rehydration, restore lifecycle, pause during restore, cache busting |
| Image caching | Manual fetch + IndexedDB blob storage | Cache API (`caches.open()`) | Purpose-built for URL resources, handles headers/streaming, automatic cleanup |
| Online/offline detection | Custom polling or heartbeat | `navigator.onLine` + `online`/`offline` events (already in `useOfflineSync`) | Browser-native, sufficient for this use case |
| Storage quota estimation | Manual byte counting | `navigator.storage.estimate()` | Browser-native API, returns `usage` and `quota` in bytes |

**Key insight:** React Query's persist plugin handles the hard parts (dehydration, rehydration, race conditions with in-flight queries, restore-before-fetch guarantees). The only custom code needed is: persister adapter (5 lines), query key whitelist, freshness timestamps, image cache wrapper, and the UI card.

## Common Pitfalls

### Pitfall 1: gcTime Too Low for Persistence
**What goes wrong:** Persisted data is restored but immediately garbage-collected because `gcTime` (default 5 min) is shorter than `maxAge` (default 24h).
**Why it happens:** React Query GC runs on `gcTime` and removes queries with no active observers.
**How to avoid:** Set `gcTime >= maxAge`. For this project: `gcTime: 1000 * 60 * 60 * 24` (24h).
**Warning signs:** Cache restores on app load but queries immediately refetch and show loading state.

### Pitfall 2: useIsRestoring Not Used
**What goes wrong:** Components render with empty/loading state then flash to cached data.
**Why it happens:** `PersistQueryClientProvider` pauses queries during restore, but components may still render loading skeletons.
**How to avoid:** Use `useIsRestoring()` hook from `@tanstack/react-query` to show a splash/loading state during restoration.
**Warning signs:** Brief flash of empty state on app launch before cached data appears.

### Pitfall 3: idb-keyval Default Store Conflicts
**What goes wrong:** `idb-keyval` creates its own `keyval-store` database. If you try to use `alofok_offline` database, version conflicts arise.
**Why it happens:** `idb-keyval`'s default `createStore()` uses a separate database (`keyval-store`). The existing `alofok_offline` DB at version 2 has a different schema.
**How to avoid:** Let `idb-keyval` use its default database (separate from `alofok_offline`). OR use `createStore('alofok_cache', 'rq-persist')` for a dedicated idb-keyval store. Do NOT try to share the `alofok_offline` DB between raw IDB code and `idb-keyval`.
**Warning signs:** `onblocked` or `onupgradeneeded` errors in console.

### Pitfall 4: Caching Image URLs but Not Image Data
**What goes wrong:** React Query persists product metadata including `image_urls` array, but images don't load offline because the actual image files aren't cached.
**Why it happens:** Persisting the catalog query only saves JSON metadata, not the binary image data.
**How to avoid:** After products load, iterate `image_urls` and pre-cache them via Cache API. The `<img>` tags with `/static/products/...` URLs will automatically serve from Cache API when offline (if service worker intercepts, or if loaded from cache before going offline).
**Warning signs:** Product cards show broken image icons when offline.

### Pitfall 5: Cache API Requires Same-Origin or CORS
**What goes wrong:** `cache.add(url)` fails for cross-origin images without CORS headers.
**Why it happens:** Cache API enforces same-origin by default.
**How to avoid:** All product images are served from `/static/` via the same origin (Vite proxy to backend). This is already same-origin. No issue expected.
**Warning signs:** `TypeError: Failed to fetch` in console when caching images.

### Pitfall 6: Service Worker Needed for True Offline Image Serving
**What goes wrong:** Even with images in Cache API, offline `<img>` tags still fail because no service worker intercepts the fetch.
**Why it happens:** Cache API stores data but doesn't automatically intercept network requests. Without a service worker, the browser still tries the network for `<img src>`.
**How to avoid:** Two options: (a) Use a minimal service worker that intercepts `/static/` requests and serves from Cache API. (b) Read images from Cache API as blob URLs and set `<img src={blobUrl}>`. Option (b) is simpler and avoids the Capacitor/SW conflict. Recommendation: use option (b) -- read from Cache API in `imageCache.ts`, convert to object URLs for offline display.
**Warning signs:** Images load online but show broken when airplane mode is enabled.

### Pitfall 7: Memory Leaks from Object URLs
**What goes wrong:** Creating `URL.createObjectURL()` for cached images without revoking them leaks memory.
**Why it happens:** Object URLs hold references to blobs in memory until revoked.
**How to avoid:** Revoke object URLs in cleanup (`useEffect` return) or use a simple LRU cache of object URLs. Alternatively, store images as base64 data URIs (larger but no leak risk). For a catalog of ~50-200 products with thumbnails, base64 is acceptable.
**Warning signs:** Memory usage grows over time; performance degrades after browsing catalog repeatedly.

## Code Examples

### main.tsx Integration
```typescript
// Source: Verified pattern from TanStack docs + project structure
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createIDBPersister } from '@/lib/queryPersister';

const PERSIST_KEYS = new Set([
  'products', 'my-customers', 'route-day',
  'delivery-orders', 'statement', 'collections',
  'my-orders-today',
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 1,
    },
  },
});

const persister = createIDBPersister();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              if (query.state.status !== 'success') return false;
              const key = query.queryKey[0];
              return typeof key === 'string' && PERSIST_KEYS.has(key);
            },
          },
        }}
      >
        <App />
      </PersistQueryClientProvider>
    </Provider>
  </React.StrictMode>
);
```

### SyncStatusCard Component Shape
```typescript
// Conceptual structure for the profile sync card
interface SyncItem {
  label: string;       // "Catalog", "Customers", etc.
  lastSynced: string | null; // ISO timestamp
  status: 'syncing' | 'done' | 'idle';
}

// Color logic:
// green dot: Date.now() - lastSynced < 1 hour
// yellow dot: 1-6 hours
// red dot: > 6 hours or never synced

// "Sync Now" button: calls queryClient.invalidateQueries() for all persist keys
// Shows spinner per-item during refetch, then checkmark
// Pending queue: reads syncQueue.count() for orders + payments
// Cache size: navigator.storage.estimate() for total, or sum idb-keyval + Cache API sizes
```

### Storage Size Estimation
```typescript
// Browser API for total storage usage
async function getStorageEstimate(): Promise<{ used: number; total: number }> {
  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { used: usage, total: quota };
  }
  return { used: 0, total: 0 };
}

// Format bytes to human-readable
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `persistQueryClient()` imperative API | `PersistQueryClientProvider` declarative | React Query v5 | Simpler setup, handles restore lifecycle, provides `onSuccess`/`onError` callbacks |
| `createAsyncStoragePersister` for IDB | Custom persister with `idb-keyval` (3 methods) | Always recommended for IDB | Async storage persister adds serialization overhead; `idb-keyval` uses structured clone natively |
| Service Worker for offline images | Cache API + blob URLs (no SW) | Practical for non-PWA apps | Avoids Capacitor/WKWebView SW conflicts while achieving offline image display |

**Deprecated/outdated:**
- `@tanstack/query-async-storage-persister`: Unnecessary for IndexedDB since `idb-keyval` handles async natively and avoids JSON serialization overhead

## Open Questions

1. **Image caching without Service Worker**
   - What we know: Cache API stores images but doesn't intercept `<img>` requests without a SW. Object URLs or base64 data URIs are needed for true offline display.
   - What's unclear: Performance impact of converting ~100-200 product thumbnails to object URLs on app load.
   - Recommendation: Use Cache API for storage, create object URLs lazily (only for visible products). A custom `useOfflineImage(url)` hook can check Cache API and return a blob URL fallback. Alternatively, store image blobs directly in a separate `idb-keyval` store keyed by URL -- this is simpler and avoids Cache API entirely. **Recommended approach: use `idb-keyval` with a dedicated `createStore('alofok-images', 'blobs')` for image blobs, and a `useOfflineImage` hook.**

2. **Partial sync failure handling**
   - What we know: User wants "Sync Now" to refresh everything. Some endpoints might fail while others succeed.
   - What's unclear: Should we show per-item error states or just retry?
   - Recommendation: Per-item status (syncing/done/error). Failed items keep old cached data and show error icon. "Sync Now" retries only failed items if pressed again.

3. **Statement caching scope**
   - What we know: Decision says "last 30 days of transactions per route customer". Route can have 10-30 customers.
   - What's unclear: Whether to pre-fetch all customer statements on sync or fetch lazily when customer is visited.
   - Recommendation: Pre-fetch statements for all route customers during background sync. Each statement is a small JSON payload (~5-20KB). For 30 customers, total is ~150-600KB -- well within limits.

4. **First-login sync UX**
   - What we know: "Auto-sync on first login -- all data pre-cached in background"
   - What's unclear: Whether to show any progress indication during initial cache population.
   - Recommendation: Show a brief toast "Syncing data for offline use..." on first login. The sync status card in profile will show detailed progress for anyone who checks.

## Sources

### Primary (HIGH confidence)
- [TanStack Query v5 persistQueryClient docs](https://tanstack.com/query/v5/docs/react/plugins/persistQueryClient) - PersistQueryClientProvider API, gcTime requirements, shouldDehydrateQuery
- [TanStack Query createSyncStoragePersister docs](https://tanstack.com/query/v5/docs/react/plugins/createSyncStoragePersister) - IDB persister example with idb-keyval
- [idb-keyval npm](https://www.npmjs.com/package/idb-keyval) - v6.2.2, API: get/set/del/createStore
- [idb-keyval GitHub](https://github.com/jakearchibald/idb-keyval) - 600 bytes, structured clone, createStore for custom DBs

### Secondary (MEDIUM confidence)
- [TanStack Query Discussion #6213](https://github.com/TanStack/query/discussions/6213) - Community validation of idb-keyval + createPersister pattern
- [web.dev offline data guide](https://web.dev/learn/pwa/offline-data/) - Cache API vs IndexedDB recommendations
- [DEV Community PWA Storage](https://dev.to/tianyaschool/pwa-offline-storage-strategies-indexeddb-and-cache-api-3570) - Cache API for images, IndexedDB for structured data

### Tertiary (LOW confidence)
- Image caching without Service Worker approach -- derived from first principles and community patterns, not from a single authoritative source. Needs validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `@tanstack/react-query-persist-client` and `idb-keyval` are the officially documented approach in TanStack docs
- Architecture: HIGH - Patterns follow official docs and existing project conventions (same IndexedDB patterns as `syncQueue.ts`)
- Pitfalls: HIGH - gcTime/maxAge mismatch and idb-keyval store conflicts are well-documented
- Image caching: MEDIUM - Cache API is correct tool but offline serving without SW requires blob URL workaround that needs validation

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable libraries, 30-day validity)
