# State: Alofok

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Sales Reps can visit customers, take orders, collect payments, and resolve balance disputes — even offline.
**Current focus:** v1.1 Check Enhancement

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-04 — Milestone v1.1 started

## Accumulated Context

- All 22 PRD features shipped
- Customer portal added with separate auth flow
- Delivery date routing and bonus orders added
- Design system fully rebuilt (dark/red theme, 36+ components)
- Long-press multi-select for order cards added
- Admin reassignment and order management added
- Current check JSONB: {bank, due_date, image_url} — expanding to include bank_number, branch_number, account_number, holder_name
- Check status enum exists (Pending/Deposited/Returned/Cleared) — only Return has UI currently
- Bank name dropdown will autocomplete from previously used banks
