---
phase: 19-frontend-component-dedup-simplification
plan: 01
subsystem: ui
tags: [react, component-dedup, refactor, statement-view, cart-view]

requires:
  - phase: 18-frontend-shared-utilities
    provides: useCart hook, format.ts, getProductName shared utilities
provides:
  - StatementViewBase shared component for statement deduplication
  - Extracted CartView, CustomerSelector, SalesProfileView in Sales/views/
  - Slim Sales/index.tsx (197 lines, down from 979)
affects: [19-02-frontend-component-dedup]

tech-stack:
  added: []
  patterns: [shared-base-component-with-props, view-extraction-pattern]

key-files:
  created:
    - frontend/src/components/shared/StatementViewBase.tsx
    - frontend/src/components/Sales/views/CartView.tsx
    - frontend/src/components/Sales/views/CustomerSelector.tsx
    - frontend/src/components/Sales/views/SalesProfileView.tsx
  modified:
    - frontend/src/components/Sales/index.tsx
    - frontend/src/components/Sales/StatementView.tsx
    - frontend/src/components/Customer/StatementView.tsx

key-decisions:
  - "StatementViewBase uses fetchStatement prop + queryKeyPrefix for data fetching — cleanest dedup since only fetch differs"
  - "getAutoDeliveryDate co-located with CartView since it is only used in order placement flow"
  - "Opening balance shown only when not loading (merged Customer behavior into shared base)"

patterns-established:
  - "Shared base component pattern: StatementViewBase accepts fetchStatement + queryKeyPrefix, callers are thin wrappers"
  - "View extraction pattern: Sales/views/ directory for sub-views of the Sales root"

requirements-completed: [FRONT-02, SIMP-01]

duration: 4min
completed: 2026-03-09
---

# Phase 19 Plan 01: StatementViewBase and Sales Monolith Breakup Summary

**Shared StatementViewBase deduplicating Sales/Customer statement views, plus CartView/CustomerSelector/ProfileView extraction slimming Sales/index.tsx from 979 to 197 lines**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T13:10:28Z
- **Completed:** 2026-03-09T13:14:07Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created StatementViewBase shared component (358 lines) used by both Sales and Customer statement views
- Extracted CartView, CustomerSelector, SalesProfileView into Sales/views/ directory
- Reduced Sales/index.tsx from 979 lines to 197 lines (80% reduction)
- Sales and Customer StatementViews are now thin wrappers (20-21 lines each)
- Admin StatementView continues working unchanged via preserved props interface

## Task Commits

Each task was committed atomically:

1. **Task 1: Create StatementViewBase and extract Sales views** - `3f2f1db` (feat)
2. **Task 2: Wire consumers to shared components and slim Sales/index.tsx** - `e7029e7` (refactor)

## Files Created/Modified
- `frontend/src/components/shared/StatementViewBase.tsx` - Shared statement view with configurable fetchStatement prop
- `frontend/src/components/Sales/views/CartView.tsx` - Cart view + getAutoDeliveryDate helper extracted from monolith
- `frontend/src/components/Sales/views/CustomerSelector.tsx` - Customer selector dropdown extracted from monolith
- `frontend/src/components/Sales/views/SalesProfileView.tsx` - Profile view with settings, sync status, logout
- `frontend/src/components/Sales/index.tsx` - Slim SalesRoot shell (197 lines, was 979)
- `frontend/src/components/Sales/StatementView.tsx` - Thin wrapper delegating to StatementViewBase
- `frontend/src/components/Customer/StatementView.tsx` - Thin wrapper delegating to StatementViewBase with showDraftBadge

## Decisions Made
- StatementViewBase uses `fetchStatement` prop + `queryKeyPrefix` instead of accepting raw data -- cleanest approach since only the fetch function and a few UI flags differ between Sales and Customer
- Opening balance rendering uses `!isLoading` guard (merged from Customer behavior) instead of always showing (Sales behavior) -- more correct UX
- `getAutoDeliveryDate` co-located with CartView rather than a separate utils file since it is only used in the order placement flow
- CheckPhotoThumbnail uses the Customer portal's safer `typeof tx.data?.image_url === "string"` check in the shared base

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- StatementViewBase is ready for any future statement view consumers
- Sales/views/ directory established for Plan 02 (ProfileView shared component)
- All builds clean: tsc + vite build pass

---
*Phase: 19-frontend-component-dedup-simplification*
*Completed: 2026-03-09*
