---
phase: 10-db-foundation
plan: "01"
subsystem: database
tags: [postgres, sqlalchemy, alembic, migrations, indexes, enums]

# Dependency graph
requires: []
provides:
  - "TransactionType.Purchase enum value on transactiontype PostgreSQL type"
  - "Four performance indexes on transactions table (created_by, type, status, compound)"
  - "expenses table with ExpenseType, ExpenseCategory, ExpenseStatus enums"
  - "daily_cash_confirmations table with unique constraint on (rep_id, date)"
  - "Expense and DailyCashConfirmation SQLAlchemy models registered in models/__init__.py"
affects: [11-daily-cash-report, 12-expense-tracking, 14-purchase-from-customer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "COMMIT/BEGIN wrapper pattern for ALTER TYPE ADD VALUE (PostgreSQL enum extension in Alembic)"
    - "sa.Enum with create_type=True at module level in migration for enum lifecycle management"
    - "BaseMixin inheritance pattern for all new models (id, created_at, updated_at, is_deleted)"
    - "explicit foreign_keys= on SQLAlchemy relationships to avoid AmbiguousForeignKeysError"

key-files:
  created:
    - backend/app/models/expense.py
    - backend/app/models/daily_cash_confirmation.py
    - backend/alembic/versions/e1f2a3b4c5d6_add_transaction_indexes_and_purchase_enum.py
    - backend/alembic/versions/f2a3b4c5d6e7_add_expenses_and_daily_cash_confirmations.py
  modified:
    - backend/app/models/transaction.py
    - backend/app/models/__init__.py

key-decisions:
  - "Enum types in Migration B defined as module-level sa.Enum objects (not inline) so create_type=True creates them exactly once — avoids DuplicateObjectError from SQLAlchemy auto-creation during op.create_table"
  - "No op.execute CREATE TYPE for new enums — let SQLAlchemy handle creation via sa.Enum with create_type=True"

patterns-established:
  - "Migration enum pattern: define sa.Enum at module level, reference in column definitions, SQLAlchemy creates type once"
  - "All new models inherit BaseMixin, Base in that order with explicit __tablename__"

requirements-completed: [DB-01]

# Metrics
duration: 25min
completed: 2026-03-05
---

# Phase 10 Plan 01: DB Foundation Summary

**Four transaction performance indexes, Purchase enum value, Expense model (9-category enum), and DailyCashConfirmation model with rep+date unique constraint via two chained Alembic migrations**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-05T15:35:00Z
- **Completed:** 2026-03-05T15:59:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `Purchase = "Purchase"` to `TransactionType` enum with COMMIT/BEGIN wrapper migration pattern
- Created four indexes on transactions table: `ix_transactions_created_by`, `ix_transactions_type`, `ix_transactions_status`, `ix_transactions_created_by_type_created_at`
- Built `Expense` model with `ExpenseType` (Field/Business), `ExpenseCategory` (9 values), `ExpenseStatus` (Pending/Confirmed/Flagged) enums and two relationships using explicit `foreign_keys=`
- Built `DailyCashConfirmation` model with `UniqueConstraint("rep_id", "date", name="uq_daily_cash_rep_date")`
- Registered both new models in `app/models/__init__.py`
- Alembic head confirmed at `f2a3b4c5d6e7`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Purchase enum value and transaction indexes** - `7a17bf4` (feat)
2. **Task 2: Create Expense and DailyCashConfirmation models and migration** - `0cd2735` (feat)

## Files Created/Modified
- `backend/app/models/transaction.py` - Added `Purchase = "Purchase"` to `TransactionType` enum
- `backend/app/models/expense.py` - New: Expense model with ExpenseType, ExpenseCategory, ExpenseStatus enums
- `backend/app/models/daily_cash_confirmation.py` - New: DailyCashConfirmation model with unique constraint
- `backend/app/models/__init__.py` - Registered Expense, ExpenseType, ExpenseCategory, ExpenseStatus, DailyCashConfirmation
- `backend/alembic/versions/e1f2a3b4c5d6_add_transaction_indexes_and_purchase_enum.py` - Migration A: Purchase enum + 4 indexes
- `backend/alembic/versions/f2a3b4c5d6e7_add_expenses_and_daily_cash_confirmations.py` - Migration B: expenses + daily_cash_confirmations tables

## Decisions Made
- Defined `sa.Enum` objects at migration module level (not inline in column defs) to ensure SQLAlchemy creates each enum type exactly once — avoids `DuplicateObjectError` that occurs when `op.create_table` triggers auto-creation alongside manual `op.execute("CREATE TYPE ...")` calls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DuplicateObjectError in Migration B enum creation**
- **Found during:** Task 2 (Migration B execution)
- **Issue:** Plan specified `op.execute("CREATE TYPE expensetype ...")` calls before `op.create_table`, but SQLAlchemy auto-creates enum types from loaded model metadata during `op.create_table`, causing `DuplicateObjectError: type "expensetype" already exists`
- **Fix:** Removed manual `op.execute("CREATE TYPE...")` calls; instead defined `sa.Enum` objects at module level in the migration with `create_type=True` (default), letting SQLAlchemy handle creation exactly once
- **Files modified:** `backend/alembic/versions/f2a3b4c5d6e7_add_expenses_and_daily_cash_confirmations.py`
- **Verification:** Migration runs cleanly, all enum types created, `expenses` and `daily_cash_confirmations` tables exist with correct schema
- **Committed in:** `0cd2735` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was necessary for migration to run. No scope creep — same end result, different enum creation mechanism.

## Issues Encountered
- PostgreSQL `CREATE TYPE IF NOT EXISTS` syntax is not supported even in v18.1 — confirmed by testing. Resolved via module-level `sa.Enum` objects instead.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DB foundation complete: transactions table indexed, Purchase enum live, expenses and daily_cash_confirmations tables ready
- Phase 11 (Daily Cash Report) can proceed — `daily_cash_confirmations` table with unique constraint available
- Phase 12 (Expense Tracking) can proceed — `expenses` table with all required columns available
- Phase 14 (Purchase from Customer) can proceed — `TransactionType.Purchase` enum value available

---
*Phase: 10-db-foundation*
*Completed: 2026-03-05*
