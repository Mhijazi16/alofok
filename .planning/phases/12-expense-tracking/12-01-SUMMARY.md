---
phase: 12-expense-tracking
plan: 01
subsystem: api
tags: [fastapi, expenses, ledger, crud]

requires:
  - phase: 10-db-foundation
    provides: CompanyLedger model, LedgerDirection/LedgerPaymentMethod/LedgerStatus enums
  - phase: 11-daily-cash-report
    provides: LedgerRepository, LedgerService, LedgerEntryOut schema, ledger router
provides:
  - POST /ledger/expenses endpoint for creating expense entries
  - GET /ledger/my-expenses endpoint for listing rep's expenses by date
  - DELETE /ledger/expenses/{id} endpoint for soft-deleting pending expenses
  - ExpenseCreateIn schema with category and amount validation
  - LedgerRepository.get_by_rep_and_direction and soft_delete methods
  - LedgerService.create_expense, get_rep_expenses, delete_expense methods
affects: [12-expense-tracking]

tech-stack:
  added: []
  patterns: [role-based category restriction at endpoint level, conditional status by role]

key-files:
  created: []
  modified:
    - backend/app/schemas/ledger.py
    - backend/app/repositories/ledger_repository.py
    - backend/app/services/ledger_service.py
    - backend/app/api/endpoints/ledger.py

key-decisions:
  - "Role-based category restriction at endpoint level, not schema level -- schema validates full superset, endpoint narrows for Sales"
  - "Admin expenses auto-confirmed, Sales expenses start pending -- aligns with existing confirm/flag workflow"

patterns-established:
  - "Expense entries are outgoing ledger entries with payment_method=cash and no source_transaction_id"
  - "Manual expenses distinguished from payment-sourced entries via source_transaction_id IS NULL filter"

requirements-completed: [EXP-01, EXP-02, EXP-04, EXP-05]

duration: 2min
completed: 2026-03-06
---

# Phase 12 Plan 01: Backend Expense CRUD Summary

**Expense CRUD endpoints on ledger router with role-based category restriction and auto-confirm for Admin**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T13:36:37Z
- **Completed:** 2026-03-06T13:38:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ExpenseCreateIn schema validates category against 9 allowed values and rejects non-positive amounts
- Three new endpoints: POST /ledger/expenses, GET /ledger/my-expenses, DELETE /ledger/expenses/{id}
- Sales reps restricted to 5 categories (Food, Fuel, Gifts, CarWash, Other); Admins can use all 9
- Admin expenses auto-confirmed; Sales expenses start as pending for admin review
- Soft delete only allowed on caller-owned pending manual expenses

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ExpenseCreateIn schema and repository methods** - `daaac9a` (feat)
2. **Task 2: Add expense service methods and API endpoints** - `1e5e5f8` (feat)
3. **Formatting fix** - `5268379` (chore)

## Files Created/Modified
- `backend/app/schemas/ledger.py` - Added ExpenseCreateIn with category/amount validators and ALLOWED_EXPENSE_CATEGORIES set
- `backend/app/repositories/ledger_repository.py` - Added get_by_rep_and_direction and soft_delete methods
- `backend/app/services/ledger_service.py` - Added create_expense, get_rep_expenses, delete_expense methods with ownership/status guards
- `backend/app/api/endpoints/ledger.py` - Added POST /expenses, GET /my-expenses, DELETE /expenses/{id} with role-based category restriction

## Decisions Made
- Role-based category restriction at endpoint level, not schema level -- schema validates full superset, endpoint narrows for Sales
- Admin expenses auto-confirmed, Sales expenses start pending -- aligns with existing confirm/flag workflow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend expense CRUD complete, ready for Phase 12 Plan 02 (frontend expense UI)
- Expenses automatically appear in daily cash report since they are outgoing ledger entries
- Existing PATCH /ledger/status endpoint works for confirm/flag of expenses

---
*Phase: 12-expense-tracking*
*Completed: 2026-03-06*
