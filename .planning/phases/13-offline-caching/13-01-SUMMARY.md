---
phase: 13-offline-caching
plan: 01
subsystem: ui
tags: [react-query, indexeddb, idb-keyval, offline, cache-persistence, pwa]

requires:
  - phase: 12-expense-tracking
    provides: "Working frontend with React Query data layer"
provides:
  - "IDB persister for React Query cache persistence across page reloads"
  - "Product image blob caching in dedicated IndexedDB store"
  - "useCacheSync hook with auto-refresh on online event and manual syncAll"
  - "PersistQueryClientProvider wrapping app with 24h gcTime and query whitelist"
affects: [13-offline-caching, 14-purchase-from-customer]

tech-stack:
  added: ["@tanstack/react-query-persist-client", "idb-keyval"]
  patterns: ["IDB persister pattern", "Dedicated idb-keyval stores per concern", "Query key whitelist for selective persistence"]

key-files:
  created:
    - frontend/src/lib/queryPersister.ts
    - frontend/src/lib/imageCache.ts
    - frontend/src/hooks/useCacheSync.ts
  modified:
    - frontend/src/main.tsx
    - frontend/package.json

key-decisions:
  - "Separate idb-keyval stores: default store for RQ cache, alofok-images for blobs, alofok_offline for sync queue -- avoids IndexedDB version conflicts"
  - "PERSIST_QUERY_KEYS exported as module-level const from useCacheSync.ts so main.tsx can import without using the hook"
  - "gcTime and maxAge both set to 24h (not Infinity) per research anti-pattern guidance"

patterns-established:
  - "IDB persister: createIDBPersister() wraps idb-keyval get/set/del with Persister interface"
  - "Image cache: dedicated createStore for blob isolation, Promise.allSettled for resilient batch caching"
  - "Query whitelist: shouldDehydrateQuery checks query key against PERSIST_QUERY_KEYS array"

requirements-completed: [OFFL-01, OFFL-02]

duration: 3min
completed: 2026-03-06
---

# Phase 13 Plan 01: Offline Cache Persistence Summary

**React Query cache persisted to IndexedDB via idb-keyval with 24h TTL, product image blob caching, and auto-refresh on reconnect**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T15:41:47Z
- **Completed:** 2026-03-06T15:44:19Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- React Query cache persists whitelisted queries (products, customers, orders, statements) to IndexedDB across page reloads
- Product images cached as blobs in a dedicated idb-keyval store, served as object URLs when offline
- Auto-refresh on online event and app mount, with manual syncAll() for user-triggered refresh
- PersistQueryClientProvider wired into app root with 24h gcTime/maxAge and selective dehydration

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps + create queryPersister and imageCache utilities** - `e1a5130` (feat)
2. **Task 2: Create useCacheSync hook and wire PersistQueryClientProvider** - `1f1876e` (feat)

## Files Created/Modified
- `frontend/src/lib/queryPersister.ts` - IDB persister with persist/restore/remove methods using idb-keyval default store
- `frontend/src/lib/imageCache.ts` - Product image blob caching with dedicated alofok-images store
- `frontend/src/hooks/useCacheSync.ts` - Cache sync hook: freshness timestamps, syncAll, auto-refresh on online, periodic pending count
- `frontend/src/main.tsx` - PersistQueryClientProvider with gcTime 24h, maxAge 24h, shouldDehydrateQuery whitelist
- `frontend/package.json` - Added @tanstack/react-query-persist-client and idb-keyval

## Decisions Made
- Separate idb-keyval stores per concern (default for RQ, alofok-images for blobs) to avoid IndexedDB version conflicts with existing alofok_offline DB
- PERSIST_QUERY_KEYS exported as module-level const so main.tsx can import it without using the React hook
- gcTime and maxAge both 24h (not Infinity) following research anti-pattern guidance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in Admin/Overview, Admin/index, Customer/index, Sales/PaymentFlow prevented `tsc -b` from passing. These are unrelated to offline caching changes. Logged to `deferred-items.md`. Vite build passes clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Offline data layer complete -- queries restore from IndexedDB on app load
- Ready for Phase 13 Plan 02 (freshness UI indicators, if planned) or Phase 14 (Purchase from Customer with offline catalog available)
- useCacheSync hook available for components to show sync status and trigger manual refresh

---
*Phase: 13-offline-caching*
*Completed: 2026-03-06*
