---
phase: quick-fix
plan: 1
subsystem: backend-schema
tags: [bugfix, serialization, pydantic, transaction]
dependency_graph:
  requires: []
  provides: [TransactionOut-dict-data]
  affects: [order-card-display, statement-view]
tech_stack:
  added: []
  patterns: [pydantic-output-schema-typed-as-dict]
key_files:
  modified:
    - backend/app/schemas/transaction.py
decisions:
  - "TransactionOut.data typed as dict | None — output schemas must not constrain stored JSONB shape"
  - "PaymentCreate.data remains CheckData | None for input validation (write path)"
metrics:
  duration: ~2min
  completed: 2026-03-04
---

# Quick Fix 1: Fix Order Card Click Showing No Products — Summary

**One-liner:** Changed `TransactionOut.data` from `CheckData | None` to `dict | None` so order JSONB data (`items` array) is no longer silently discarded by Pydantic.

## What Was Done

`TransactionOut` is the output schema used to serialize all transaction types (orders, payments, returned checks). Orders store `{"items": [...]}` in the JSONB `data` column, which is not a valid `CheckData` shape. Pydantic was failing to parse it as `CheckData` and returning `None`, hiding order items from the frontend.

Changing the output type to `dict | None` allows both order data and check data to pass through without coercion. `PaymentCreate.data` (the write path) remains `CheckData | None` to preserve input validation for check payments.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix TransactionOut.data type from CheckData to dict | a51a3b6 | backend/app/schemas/transaction.py |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `backend/app/schemas/transaction.py` modified (line 28: `data: dict | None`)
- [x] Commit `a51a3b6` exists
- [x] Verification script: ALL CHECKS PASSED
  - TransactionOut.data has no CheckData reference
  - TransactionOut.data accepts `{"items": [...]}` without returning None
  - PaymentCreate.data still typed as CheckData | None

## Self-Check: PASSED
