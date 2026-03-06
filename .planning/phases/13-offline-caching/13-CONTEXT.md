# Phase 13: Offline Caching - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Product catalog and route data cached in IndexedDB so Sales reps can browse products, view customers, orders, and statements while offline. Write-side offline queue (orders/payments) already exists from v1.0 — this phase adds the read-side caching layer.

</domain>

<decisions>
## Implementation Decisions

### Caching strategy
- Use `idb-keyval` + `@tanstack/react-query-persist-client` for React Query cache persistence to IndexedDB
- Existing `alofok_offline` IndexedDB database already has `sync_queue` and `check_images` stores — add new cache store(s)
- `gcTime` set high (effectively infinite) — cache never expires by time
- Cache is invalidated and refreshed when connectivity returns (online event), NOT on a timer
- Auto-refresh triggers: app open (online) + reconnect after offline

### Cache scope
- **Products**: Full catalog metadata + product images (stored as blobs in IndexedDB)
- **Route customers**: Full customer card data (name, phone, address, city, balance, assigned day, last order)
- **Today's orders**: All orders for today's route with line items
- **Customer statements**: Last 30 days of transactions per route customer
- **Product images**: Cached as-is from `/static/` — no client-side compression in this phase

### Freshness indicator — Profile sync card
- Sync status card in the Sales Profile tab (not on route view, not in banner)
- Shows per-data-type freshness: Catalog, Customers, Orders, Statements — each with relative time ("2h ago")
- Color-coded dot per item: green = fresh (<1h), yellow = aging (1-6h), red = stale (>6h)
- "Sync Now" button refreshes ALL cached data at once (no per-item selection)
- When syncing: button becomes animated loading indicator, each item shows spinner then checkmark when done
- Also shows pending write queue count: "3 orders, 1 payment pending"
- Total cache size displayed in the card

### Sync & refresh behavior
- Auto-sync on first login — all data pre-cached in background (rep doesn't need to know)
- Pre-cache everything: catalog + route customers + today's orders + statements — any tab works offline immediately
- Auto-refresh on app open (if online) and on reconnect (offline → online)
- No optimistic updates — server-authoritative. Offline orders queue but cached data stays unchanged until next sync
- Manual "Sync Now" in profile for on-demand refresh

### Offline UI experience
- Existing OfflineBanner (red pulsing dot + "You are offline") is sufficient — no additional visual changes on cached data
- All write actions (New Order, New Payment) remain active offline — existing syncQueue handles this
- No cache expiry empty states — cache persists indefinitely while offline, always shows last-known data
- When connectivity returns, cache auto-refreshes silently

### Claude's Discretion
- IndexedDB store structure (single store vs separate stores for each data type)
- React Query persist configuration details (serialization, key filtering)
- Image caching implementation (Cache API vs IndexedDB blobs)
- Background sync scheduling and error retry logic
- Profile sync card exact layout, spacing, and animation details
- How to handle partial sync failures (some endpoints succeed, others fail)

</decisions>

<specifics>
## Specific Ideas

- Profile sync card should feel like a dashboard within the profile — clean, informational, not cluttered
- Sync animation: each item shows spinner individually then flips to checkmark — gives sense of progress
- Pending queue display: "3 orders, 1 payment pending" — rep sees their offline work is safe
- Cache size visible so rep knows storage impact

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `syncQueue.ts`: IndexedDB helper (`alofok_offline` DB, version 2) — extend with new stores for cache
- `useOfflineSync.ts`: Online/offline detection, queue flush — extend or create sibling hook for cache management
- `OfflineBanner`: Already handles offline/syncing/pending states — no changes needed
- `QueryClient` in `main.tsx`: 5min staleTime configured — add persist plugin here
- `salesApi.ts`: Already has `getProducts()`, `getMyRoute()`, `getByDay()`, `getOrdersToday()` — these are the cache targets
- `EmptyState` component: Available if needed for edge cases

### Established Patterns
- React Query for all data fetching — persist plugin integrates naturally
- IndexedDB via raw API in `syncQueue.ts` — same pattern for cache stores
- `useOfflineSync` hook provides `isOnline`/`isSyncing`/`pendingCount` — cache hook should follow same pattern
- Sales profile tab exists — sync card goes here

### Integration Points
- `frontend/src/main.tsx`: Add `persistQueryClient` from `@tanstack/react-query-persist-client` + `idb-keyval` persister
- `frontend/src/lib/syncQueue.ts`: Bump DB version, add cache object store(s)
- `frontend/src/hooks/`: New `useCacheSync` hook (or extend `useOfflineSync`)
- `frontend/src/services/salesApi.ts`: Add statement fetching for cache population
- `frontend/src/components/Sales/`: Profile tab — add sync status card
- `frontend/package.json`: Add `idb-keyval`, `@tanstack/react-query-persist-client`

</code_context>

<deferred>
## Deferred Ideas

- Image compression pipeline (compress on upload, serve smaller images) — separate optimization phase
- Offline expense submission (OFFL-04) — tracked in REQUIREMENTS.md future section
- vite-plugin-pwa / Service Worker for full PWA — conflicts with Capacitor WKWebView, evaluate in v1.3
- Per-item selective sync (let rep choose what to cache) — unnecessary complexity for now

</deferred>

---

*Phase: 13-offline-caching*
*Context gathered: 2026-03-06*
