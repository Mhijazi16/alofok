---
phase: 18-frontend-shared-utilities
plan: 01
subsystem: ui
tags: [typescript, react, refactoring, dedup, i18n]

requires: []
provides:
  - "Shared format.ts with formatCurrency, formatDate, formatTime"
  - "Shared jwt.ts with decodeJwt and UserRole type"
  - "Shared product.ts with getProductName"
affects: [19-frontend-component-dedup]

tech-stack:
  added: []
  patterns:
    - "Shared utility modules in src/lib/ for cross-component logic"
    - "UserRole type canonical source in lib/jwt.ts, re-exported from authSlice"

key-files:
  created:
    - frontend/src/lib/format.ts
    - frontend/src/lib/jwt.ts
    - frontend/src/lib/product.ts
  modified:
    - frontend/src/store/authSlice.ts
    - frontend/src/pages/LoginPage.tsx
    - frontend/src/components/Sales/StatementView.tsx
    - frontend/src/components/Sales/OrderFlow.tsx
    - frontend/src/components/Sales/PaymentFlow.tsx
    - frontend/src/components/Sales/PurchaseFlow.tsx
    - frontend/src/components/Sales/CustomerDashboard.tsx
    - frontend/src/components/Sales/index.tsx
    - frontend/src/components/Customer/index.tsx
    - frontend/src/components/Customer/CatalogView.tsx
    - frontend/src/components/Customer/OrdersView.tsx
    - frontend/src/components/Customer/StatementView.tsx
    - frontend/src/components/ui/option-picker-dialog.tsx
    - frontend/src/components/ui/product-detail.tsx
    - frontend/src/components/Admin/index.tsx
    - frontend/src/components/Designer/ProductList.tsx

key-decisions:
  - "Used en-US locale with month/day/year for formatDate (matching actual codebase, not en-GB from plan)"
  - "Kept variant formatCurrency local: no-decimal (RouteView, OrderModal, AllCustomersView), Math.abs (Customer Dashboard/OrdersView/ProfileView), 2-arg currency (ReturnedChecksView)"
  - "Moved UserRole type to lib/jwt.ts as canonical source, re-exported from authSlice for backward compatibility"

patterns-established:
  - "Shared utilities in src/lib/ for cross-cutting formatting and auth logic"
  - "getProductName() as single entry point for localized product names"

requirements-completed: [FRONT-04, FRONT-05, FRONT-06]

duration: 8min
completed: 2026-03-09
---

# Phase 18 Plan 01: Shared Utility Modules Summary

**Three shared utility modules (format.ts, jwt.ts, product.ts) replacing ~30 inline duplicates across 16 consumer files**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-09T12:33:13Z
- **Completed:** 2026-03-09T12:41:00Z
- **Tasks:** 2
- **Files modified:** 19 (3 created, 16 modified)

## Accomplishments
- Created format.ts with formatCurrency, formatDate, formatTime -- single source for all standard formatting
- Created jwt.ts with decodeJwt and UserRole type -- eliminated 2 duplicate JWT decode functions
- Created product.ts with getProductName -- replaced ~12 inline name_ar/name_en ternary patterns
- Removed ~15 inline formatCurrency definitions, ~5 formatDate/formatTime definitions
- Cleaned up 5 unused i18n destructurings after product name extraction

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared utility modules** - `4d402fb` (feat)
2. **Task 2: Replace all inline duplicates with shared imports** - `5a3a8e7` (refactor)

## Files Created/Modified
- `frontend/src/lib/format.ts` - formatCurrency, formatDate, formatTime shared utilities
- `frontend/src/lib/jwt.ts` - decodeJwt function and UserRole type
- `frontend/src/lib/product.ts` - getProductName with i18n-aware name resolution
- `frontend/src/store/authSlice.ts` - Imports decodeJwt from lib/jwt, re-exports UserRole
- `frontend/src/pages/LoginPage.tsx` - Imports decodeJwt from lib/jwt
- `frontend/src/components/Sales/*.tsx` - 7 files updated to use shared imports
- `frontend/src/components/Customer/*.tsx` - 4 files updated to use shared imports
- `frontend/src/components/Admin/index.tsx` - Uses getProductName
- `frontend/src/components/Designer/ProductList.tsx` - Uses getProductName
- `frontend/src/components/ui/option-picker-dialog.tsx` - Uses formatCurrency + getProductName
- `frontend/src/components/ui/product-detail.tsx` - Uses getProductName

## Decisions Made
- Used en-US locale with month/day/year for shared formatDate (matching the actual most common pattern in codebase, not en-GB from plan)
- Kept variant formatCurrency definitions local where behavior differs: no-decimal display (RouteView, OrderModal, AllCustomersView), Math.abs wrapping (Customer Dashboard/OrdersView/ProfileView), 2-arg currency (ReturnedChecksView)
- Moved UserRole type to lib/jwt.ts as canonical source to avoid circular imports; re-exported from authSlice for backward compatibility
- CustomerDashboard's nullable formatDate renamed to formatDateShort (different format: month/day only, no year)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected formatDate locale and options**
- **Found during:** Task 1
- **Issue:** Plan specified en-GB locale for formatDate, but all actual codebase uses were en-US with month/short/day/numeric/year/numeric
- **Fix:** Used en-US locale with actual codebase format options
- **Verification:** TypeScript compiles, Vite builds, formatting matches existing behavior

**2. [Rule 1 - Bug] Corrected formatTime implementation**
- **Found during:** Task 1
- **Issue:** Plan specified ar-EG locale variant for formatTime, but no actual usage in codebase used Arabic locale
- **Fix:** Used en-US locale consistently matching all actual implementations
- **Verification:** TypeScript compiles, output matches previous inline behavior

---

**Total deviations:** 2 auto-fixed (2 bugs in plan specification)
**Impact on plan:** Both fixes ensure shared utilities match actual codebase behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared utility modules in place for Phase 19 (Frontend Component Dedup)
- Phase 19 can build on getProductName pattern for further component simplification

---
*Phase: 18-frontend-shared-utilities*
*Completed: 2026-03-09*

## Self-Check: PASSED
