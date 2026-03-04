---
phase: 08-check-lifecycle-management
plan: 01
subsystem: payments
tags: [fastapi, sqlalchemy, pydantic, rbac, state-machine]

# Dependency graph
requires:
  - phase: 06-check-data-foundation
    provides: CheckData schema and Payment_Check transaction type with status field
provides:
  - deposit_check() service method (Pending→Deposited with 409 guard)
  - return_check() extended with optional notes parameter
  - PUT /payments/checks/{id}/deposit endpoint (Admin-only)
  - PUT /payments/checks/{id}/return endpoint (Admin-only, accepts notes body)
  - PUT /payments/checks/{id}/status endpoint hardened to Admin-only
  - CheckOut schema with customer_name field
  - get_all_checks() AdminService method with optional status filter
  - GET /admin/checks endpoint (Admin-only, supports ?status= query param)
affects: [08-02-frontend-check-lifecycle, 09-image-capture-ocr]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Service-layer state machine guards using HorizonException(409) for invalid transitions
    - ReturnCheckBody inline Pydantic model in endpoint file for request body typing
    - Admin join queries using SQLAlchemy labeled columns (Customer.name.label("customer_name"))

key-files:
  created: []
  modified:
    - backend/app/services/payment_service.py
    - backend/app/api/endpoints/payments.py
    - backend/app/schemas/admin.py
    - backend/app/services/admin_service.py
    - backend/app/api/endpoints/admin.py

key-decisions:
  - "deposit is a status-only update (Pending→Deposited) — no balance changes, no linked transaction"
  - "return_check notes param defaults to 'Returned check #id' for backward compat with existing /status endpoint"
  - "existing PUT /checks/{id}/status endpoint now Admin-only (CONTEXT.md: all lifecycle actions are Admin scope)"

patterns-established:
  - "Pattern 1: State machine guards in service layer raise HorizonException(409) before any DB writes"
  - "Pattern 2: Admin join queries yield labeled columns accessed via row.Transaction.field and row.label_name"

requirements-completed: [LCY-01, LCY-02, LCY-03]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 8 Plan 1: Check Lifecycle Backend Summary

**FastAPI state machine for check lifecycle: deposit_check()/return_check() service methods with 409 guards, Admin-scoped PUT endpoints, CheckOut schema with customer_name, and GET /admin/checks list with status filter**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-04T13:07:16Z
- **Completed:** 2026-03-04T13:09:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added deposit_check() service method enforcing Pending-only guard (LCY-01, LCY-03)
- Extended return_check() with optional notes param, allowing Pending→Returned and Deposited→Returned (LCY-02)
- Added Admin-guarded PUT /payments/checks/{id}/deposit and /return endpoints
- Added CheckOut schema with customer_name field and GET /admin/checks list endpoint with ?status= filter

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deposit_check service method and extend return_check with notes** - `c7b41fa` (feat)
2. **Task 2: Add deposit/return endpoints, CheckOut schema, and admin check list** - `661d971` (feat)

## Files Created/Modified
- `backend/app/services/payment_service.py` - Added deposit_check(), extended return_check() with notes param
- `backend/app/api/endpoints/payments.py` - Added deposit/return endpoints, hardened /status to Admin-only, added ReturnCheckBody model
- `backend/app/schemas/admin.py` - Added CheckOut schema with customer_name, Currency, TransactionType, CheckData imports
- `backend/app/services/admin_service.py` - Added get_all_checks() with optional status filter and Customer join
- `backend/app/api/endpoints/admin.py` - Added GET /checks endpoint, imported TransactionStatus and CheckOut

## Decisions Made
- deposit_check() is a status-only update (no balance changes, no linked transaction) — depositing a check doesn't change the customer's balance, it was already credited when the check was recorded
- return_check() notes parameter defaults to `f"Returned check #{check_txn.id}"` preserving backward compat with existing /status endpoint callers that pass no notes
- Existing PUT /checks/{id}/status endpoint hardened to require Admin role — per CONTEXT.md all lifecycle state transitions are Admin scope only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Plan verification script used `hasattr(CheckOut, 'customer_name')` which returns False for Pydantic v2 class-level field access. Verified correct behavior using `CheckOut.model_fields` instead. Implementation is correct — this is a Pydantic v2 behavior difference.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend API complete: deposit, return, and list endpoints ready for frontend consumption
- CheckOut schema provides all fields needed for admin check management UI
- Phase 8 Plan 2 can build Admin check dashboard with deposit/return action buttons calling these endpoints

---
*Phase: 08-check-lifecycle-management*
*Completed: 2026-03-04*
