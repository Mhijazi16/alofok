---
phase: 06-check-data-foundation
plan: 01
subsystem: backend-schema, frontend-types, localization
tags: [check-payment, pydantic, typescript, alembic, i18n]
dependency_graph:
  requires: []
  provides: [CheckData-backend-model, CheckData-frontend-type, check-locale-keys, check-data-migration]
  affects: [06-02-payment-form-ui]
tech_stack:
  added: []
  patterns: [CheckData-Pydantic-model, model_dump-JSONB-serialization, backward-compatible-optional-fields]
key_files:
  created:
    - backend/alembic/versions/524125d194d6_backfill_check_data_fields.py
  modified:
    - backend/app/schemas/transaction.py
    - backend/app/services/payment_service.py
    - frontend/src/services/salesApi.ts
    - frontend/src/locales/en.json
    - frontend/src/locales/ar.json
    - frontend/src/components/Sales/RouteView.tsx
decisions:
  - "All 7 CheckData fields are Optional (None defaults) to guarantee backward compatibility with pre-v1.1 check rows"
  - "model_dump(exclude_none=True) used before JSONB storage to keep stored JSON clean"
  - "Alembic migration is data-only (no schema changes) — reconstructs JSONB with all 7 keys on existing check rows"
metrics:
  duration: "~2.5 min"
  completed: "2026-03-04"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 6
---

# Phase 6 Plan 1: Check Data Foundation Summary

**One-liner:** Typed CheckData Pydantic model with 7 backward-compatible optional fields, updated payment service validation for bank_number/branch_number/account_number, Alembic data backfill migration, and matching TypeScript interface plus locale keys.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add CheckData Pydantic model, update schemas and payment service | 93b7029 | backend/app/schemas/transaction.py, backend/app/services/payment_service.py |
| 2 | Alembic data migration, frontend types, and locale keys | 45f370f | backend/alembic/versions/524125d194d6_backfill_check_data_fields.py, frontend/src/services/salesApi.ts, frontend/src/locales/en.json, frontend/src/locales/ar.json |

## What Was Built

### Backend Schema (`backend/app/schemas/transaction.py`)
- Added `CheckData` Pydantic model with 7 optional fields: `bank`, `bank_number`, `branch_number`, `account_number`, `holder_name`, `due_date`, `image_url`
- All fields `| None = None` — critical for backward compatibility with pre-v1.1 check rows that only had `{bank, due_date}`
- `PaymentCreate.data` updated from `dict | None` to `CheckData | None`
- `TransactionOut.data` updated from `dict | None` to `CheckData | None` — Pydantic v2 auto-validates JSONB dict to CheckData on read

### Payment Service (`backend/app/services/payment_service.py`)
- Expanded check validation: now validates `bank_number`, `branch_number`, and `account_number` are present (CHK-01, CHK-02, CHK-03)
- `data=body.data.model_dump(exclude_none=True) if body.data else None` — serializes Pydantic model to plain dict for SQLAlchemy JSONB storage, `exclude_none=True` keeps stored JSON clean

### Alembic Data Migration (`backend/alembic/versions/524125d194d6_backfill_check_data_fields.py`)
- Data-only migration (no `op.add_column`) — reconstructs each check row's JSONB with all 7 keys using `jsonb_build_object`
- Existing values preserved; new keys get SQL NULL (which maps to JSON null)
- Downgrade strips the 4 new keys: `bank_number`, `branch_number`, `account_number`, `holder_name`

### Frontend TypeScript (`frontend/src/services/salesApi.ts`)
- Added `CheckData` interface with 7 optional fields matching the backend model
- `PaymentCreate.data` typed as `CheckData` (replaces inline anonymous type)
- `Transaction.data` typed as `CheckData | null` (replaces `Record<string, unknown> | null`)

### Locale Keys
- Added 4 keys in `en.json` under `payment`: `bankNumber`, `branchNumber`, `accountNumber`, `holderName`
- Added 4 matching keys in `ar.json` with Arabic translations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in RouteView.tsx caused by narrowed data type**
- **Found during:** Task 2 verification (bun run build)
- **Issue:** RouteView.tsx accessed `order.data?.items` to count order items. When `Transaction.data` changed from `Record<string, unknown>` to `CheckData`, TypeScript correctly rejected `.items` (not a CheckData field)
- **Fix:** Cast to `(order.data as any)?.items` in two places — preserves existing behavior (always returns 0 since orders don't store items in data JSONB)
- **Files modified:** `frontend/src/components/Sales/RouteView.tsx`
- **Commit:** 45f370f (included in Task 2 commit)

## Decisions Made

1. All CheckData fields are optional (`None` defaults) — required for backward compatibility (CHK-06). Old check rows missing new keys validate cleanly.
2. `model_dump(exclude_none=True)` over `model_dump()` — avoids padding stored JSONB with null values for fields not provided.
3. Data-only migration preferred over schema change — the `data` column remains `JSONB nullable`, only the contents are normalized.

## Self-Check: PASSED

All 7 key files confirmed present. Both task commits (93b7029, 45f370f) confirmed in git log. TypeScript compilation clean. Frontend build successful.
