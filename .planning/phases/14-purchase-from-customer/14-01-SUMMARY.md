---
phase: 14-purchase-from-customer
plan: 01
subsystem: api
tags: [fastapi, pydantic, wac, purchase, ledger, sqlalchemy]

requires:
  - phase: 10-db-foundation
    provides: "Purchase enum value in TransactionType, product/ledger tables"
provides:
  - "POST /purchases endpoint for Sales/Admin roles"
  - "PurchaseService with atomic WAC + stock + balance + ledger logic"
  - "PurchaseCreate/PurchaseItem Pydantic schemas"
  - "PurchaseSvc dependency injection alias"
affects: [14-purchase-from-customer, 15-statement-enhancements]

tech-stack:
  added: []
  patterns: ["FOR UPDATE row locking on product during WAC recalculation", "balance_adjustment as outgoing cash ledger entry"]

key-files:
  created:
    - backend/app/services/purchase_service.py
    - backend/app/api/endpoints/purchases.py
  modified:
    - backend/app/schemas/transaction.py
    - backend/app/api/deps.py
    - backend/app/main.py

key-decisions:
  - "Used payment_method=cash for outgoing ledger entry instead of adding new enum value -- avoids DB migration for enum extension"
  - "FOR UPDATE lock on product rows prevents race conditions when concurrent purchase syncs hit the same product"

patterns-established:
  - "Purchase service pattern: negative transaction amount + balance decrement + stock increment + WAC recalculation + outgoing ledger entry"

requirements-completed: [PURCH-01, PURCH-02, PURCH-03, PURCH-04]

duration: 2min
completed: 2026-03-07
---

# Phase 14 Plan 01: Purchase Backend API Summary

**POST /purchases endpoint with PurchaseService handling atomic WAC recalculation, stock increment, balance credit, and outgoing ledger entry**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T11:32:23Z
- **Completed:** 2026-03-07T11:34:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- PurchaseCreate/PurchaseItem schemas with Field validation (gt=0, min_length=1)
- PurchaseService.create_purchase with atomic: negative-amount transaction, balance decrement, stock increment, WAC recalculation, outgoing ledger entry
- POST /purchases endpoint at 201 with Sales/Admin role guard
- FOR UPDATE row locking prevents concurrent purchase race conditions on product stock/WAC

## Task Commits

Each task was committed atomically:

1. **Task 1: PurchaseCreate schema and PurchaseService with WAC logic** - `d15c3f0` (feat)
2. **Task 2: Purchase endpoint, DI wiring, and router registration** - `0125034` (feat)

## Files Created/Modified
- `backend/app/schemas/transaction.py` - Added PurchaseItem and PurchaseCreate Pydantic models
- `backend/app/services/purchase_service.py` - PurchaseService with create_purchase method (WAC, stock, balance, ledger)
- `backend/app/api/endpoints/purchases.py` - POST /purchases endpoint handler
- `backend/app/api/deps.py` - PurchaseSvc DI wiring and factory function
- `backend/app/main.py` - Router registration at /purchases

## Decisions Made
- Used `payment_method="cash"` for outgoing ledger entry rather than adding a new "balance_adjustment" enum value to avoid requiring a DB migration to extend the PostgreSQL native enum
- FOR UPDATE lock on product rows during WAC recalculation prevents data corruption when concurrent offline syncs update the same product

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used cash instead of balance_adjustment for ledger payment_method**
- **Found during:** Task 1 (PurchaseService implementation)
- **Issue:** Plan specified `payment_method="balance_adjustment"` but LedgerPaymentMethod enum only has "cash" and "check" -- native PG enum would reject the value without a migration
- **Fix:** Used `payment_method="cash"` as the closest semantic match for an outgoing balance adjustment
- **Files modified:** backend/app/services/purchase_service.py
- **Verification:** App loads without errors, black formatting passes
- **Committed in:** d15c3f0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor semantic difference in ledger payment_method field. No scope creep. Future plan can add "balance_adjustment" enum value via migration if needed.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Purchase backend API complete, ready for frontend purchase flow (14-02)
- TransactionType.Purchase already exists in enum from Phase 10 DB foundation
- Offline sync queue from Phase 13 can queue purchase requests

---
*Phase: 14-purchase-from-customer*
*Completed: 2026-03-07*
