---
phase: 17-backend-code-consolidation
plan: 01
subsystem: api
tags: [pydantic, sqlalchemy, n-plus-one, validation, fastapi]

requires:
  - phase: 16-schema-hardening-critical-bug-fix
    provides: "Clean schema foundation and bug fixes"
provides:
  - "OrderItemSchema Pydantic model for typed order item validation"
  - "get_orders_by_rep_with_customer JOIN query eliminating N+1"
  - "Typed attribute access in order creation/update across all services"
affects: [18-frontend-shared-utilities, 19-frontend-component-dedup]

tech-stack:
  added: []
  patterns: [typed-schema-validation, join-based-query]

key-files:
  created: [backend/tests/test_order_item_schema.py]
  modified: [backend/app/schemas/transaction.py, backend/app/schemas/customer_auth.py, backend/app/repositories/transaction_repository.py, backend/app/services/customer_service.py, backend/app/services/order_service.py, backend/app/services/customer_portal_service.py]

key-decisions:
  - "OrderItemSchema includes optional name field for display purposes"
  - "Kept existing get_orders_by_rep method unchanged for other callers"

patterns-established:
  - "Typed Pydantic schemas for all structured JSON data (no more list[dict])"
  - "JOIN-based queries for related data instead of N+1 loops"

requirements-completed: [BACK-02, BACK-04]

duration: 3min
completed: 2026-03-09
---

# Phase 17 Plan 01: N+1 Fix & Typed OrderItem Summary

**OrderItemSchema with validated fields replaces untyped list[dict] across all order schemas; get_my_orders_today uses single JOIN query instead of N+1 per-order customer lookup**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T12:09:39Z
- **Completed:** 2026-03-09T12:12:18Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 7

## Accomplishments
- OrderItemSchema validates product_id (UUID), quantity (int gt=0), unit_price (Decimal gt=0), optional name
- Replaced list[dict] with list[OrderItemSchema] in OrderCreate, OrderUpdate, and DraftOrderCreate
- Added get_orders_by_rep_with_customer JOIN query to TransactionRepository
- Rewrote get_my_orders_today to use single JOIN -- eliminates N+1 per-order customer fetch
- Updated order_service and customer_portal_service to use typed dot-access instead of dict .get()

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for OrderItemSchema** - `5d816b4` (test)
2. **Task 1 (GREEN): OrderItemSchema + N+1 fix implementation** - `68931ad` (feat)

## Files Created/Modified
- `backend/tests/test_order_item_schema.py` - 9 unit tests for schema validation
- `backend/app/schemas/transaction.py` - Added OrderItemSchema, updated OrderCreate/OrderUpdate
- `backend/app/schemas/customer_auth.py` - Updated DraftOrderCreate to use OrderItemSchema
- `backend/app/repositories/transaction_repository.py` - Added get_orders_by_rep_with_customer JOIN method
- `backend/app/services/customer_service.py` - Rewrote get_my_orders_today to use JOIN
- `backend/app/services/order_service.py` - Typed attribute access in create_order/update_order
- `backend/app/services/customer_portal_service.py` - Typed attribute access in create_draft_order

## Decisions Made
- OrderItemSchema includes optional `name` field for product display in order line items
- Kept existing `get_orders_by_rep` method unchanged since other callers may depend on it
- Used `model_dump(mode="json")` for serializing items into Transaction.data JSONB column

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Typed OrderItemSchema available for any future order-related features
- JOIN pattern established for other potential N+1 query fixes in plan 17-02/17-03

---
*Phase: 17-backend-code-consolidation*
*Completed: 2026-03-09*
