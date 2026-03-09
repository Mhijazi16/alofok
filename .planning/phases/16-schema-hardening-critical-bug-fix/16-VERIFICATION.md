---
phase: 16-schema-hardening-critical-bug-fix
verified: 2026-03-09T12:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 16: Schema Hardening & Critical Bug Fix Verification Report

**Phase Goal:** Database schema is correct, constrained, and the return_check bug no longer loses data
**Verified:** 2026-03-09T12:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Queries filtering customers by assigned_to use a database index | VERIFIED | `customer.py` line 41: `index=True` on `assigned_to` mapped_column; migration `e0b3fee5ea9f` creates `ix_customers_assigned_to` |
| 2 | Creating an expense with any model-defined ExpenseCategory succeeds without enum mismatch | VERIFIED | `ledger.py` line 41-43: `from app.models.expense import ExpenseCategory` then `ALLOWED_EXPENSE_CATEGORIES = {e.value for e in ExpenseCategory}` -- derived from model, no drift possible |
| 3 | Database rejects negative expense amounts at the constraint level | VERIFIED | `expense.py` line 52: `CheckConstraint("amount > 0", name="ck_expense_amount_positive")` in `__table_args__`; migration creates matching DB constraint |
| 4 | Database rejects negative product stock quantities at the constraint level | VERIFIED | `product.py` lines 23-25: `CheckConstraint("stock_qty >= 0 OR stock_qty IS NULL", name="ck_product_stock_qty_non_negative")` |
| 5 | Database rejects discount_type values other than 'percent' or 'fixed' at the constraint level | VERIFIED | `product.py` lines 27-30: `CheckConstraint("discount_type IN ('percent', 'fixed') OR discount_type IS NULL", name="ck_product_discount_type_valid")` |
| 6 | Returning a check persists the original check's Returned status to the database | VERIFIED | `payment_service.py` lines 144-145: `check_txn.status = TransactionStatus.Returned` followed by `await self._transactions.update(check_txn)` -- update call present before `create_many`, consistent with deposit/undeposit patterns |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/customer.py` | Index on assigned_to column | VERIFIED | `index=True` present on line 41 |
| `backend/app/models/expense.py` | CHECK constraint on expense amount | VERIFIED | `CheckConstraint` imported, `__table_args__` with `ck_expense_amount_positive` on line 52; ExpenseCategory has all 15 values (lines 26-41) |
| `backend/app/models/product.py` | CHECK constraints on stock_qty and discount_type | VERIFIED | Both constraints present in `__table_args__` lines 22-31 |
| `backend/app/schemas/ledger.py` | Synced expense categories matching model enum | VERIFIED | Import from model on line 41, derived set on line 43 |
| `backend/app/services/payment_service.py` | Persisted check status on return | VERIFIED | `await self._transactions.update(check_txn)` on line 145 |
| `backend/alembic/versions/e0b3fee5ea9f_...py` | Migration with index, enum, constraints | VERIFIED | Index creation, 6 enum value additions, 3 CHECK constraints; downgrade also present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/schemas/ledger.py` | `backend/app/models/expense.py` | `ExpenseCategory` import and derived set | WIRED | Line 41: `from app.models.expense import ExpenseCategory`; Line 43: `{e.value for e in ExpenseCategory}` |
| `backend/app/services/payment_service.py` | `backend/app/repositories/transaction_repository.py` | `update(check_txn)` call in return_check | WIRED | Line 145: `await self._transactions.update(check_txn)` -- same pattern as `deposit_check` (line 120) and `undeposit_check` (line 132) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCHEMA-01 | 16-01-PLAN | Add missing index on customers.assigned_to | SATISFIED | `index=True` in model + `ix_customers_assigned_to` in migration |
| SCHEMA-02 | 16-01-PLAN | Sync ExpenseCategory enum between model and schema | SATISFIED | 15-value enum in model, derived set in schema via import |
| SCHEMA-03 | 16-01-PLAN | Add CHECK constraints (expense amount, stock_qty, discount_type) | SATISFIED | 3 CheckConstraints in models + 3 in migration |
| BACK-01 | 16-01-PLAN | Fix return_check() to persist original check's Returned status | SATISFIED | `update(check_txn)` call added before `create_many` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns found in any modified file |

### Human Verification Required

None required. All changes are structural (database constraints, index, enum sync, persistence call) and fully verifiable via code inspection.

### Gaps Summary

No gaps found. All 6 observable truths are verified, all 5 artifacts pass all three levels (exists, substantive, wired), both key links are confirmed wired, all 4 requirements are satisfied, and no anti-patterns were detected. Both commits (`aaff31f`, `7c8d3be`) exist in git history.

---

_Verified: 2026-03-09T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
