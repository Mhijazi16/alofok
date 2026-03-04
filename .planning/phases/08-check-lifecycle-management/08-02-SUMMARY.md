---
phase: 08-check-lifecycle-management
plan: "02"
subsystem: frontend
tags: [admin, checks, lifecycle, ui, locale]
dependency_graph:
  requires: ["08-01"]
  provides: ["admin-checks-ui", "check-status-badges"]
  affects: ["frontend/src/components/Admin", "frontend/src/components/Sales", "frontend/src/components/Customer"]
tech_stack:
  added: []
  patterns: ["useQuery/useMutation for check lifecycle", "ConfirmationDialog for deposit", "raw Dialog with Textarea for return notes"]
key_files:
  created:
    - frontend/src/components/Admin/AdminChecksView.tsx
  modified:
    - frontend/src/services/adminApi.ts
    - frontend/src/components/Admin/index.tsx
    - frontend/src/components/Sales/StatementView.tsx
    - frontend/src/components/Customer/StatementView.tsx
    - frontend/src/locales/en.json
    - frontend/src/locales/ar.json
decisions:
  - "ConfirmationDialog used for deposit (simple confirm); raw Dialog used for return (needs notes Textarea — ConfirmationDialog has no extra slot)"
  - "Buttons hidden (not disabled) for invalid transitions: Pending shows both, Deposited shows only Return, Returned shows none"
  - "No optimistic updates — wait for server confirmation before cache invalidation (financial state correctness)"
  - "invalidateQueries with queryKey prefix [admin-checks] invalidates all status filter variants on mutation success"
metrics:
  duration: 148s
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_changed: 7
---

# Phase 8 Plan 2: Admin Check Lifecycle UI Summary

**One-liner:** Admin Checks tab with filter pills, check cards, deposit ConfirmationDialog, return Dialog with notes, and read-only status badges in Sales and Customer statement views.

## What Was Built

### Task 1: AdminChecksView + API + AdminPanel integration

**`frontend/src/services/adminApi.ts`**
- Added `CheckOut` interface (maps to backend CheckOut Pydantic schema from 08-01)
- Added `getChecks(status?)`, `depositCheck(checkId)`, `returnCheck(checkId, notes?)` methods
- Imports `CheckData` from salesApi for the nested `data` field type

**`frontend/src/components/Admin/AdminChecksView.tsx`** (new, ~165 lines)
- Status filter pills using `Tabs variant="pills"`: Pending (default) | Deposited | Returned | All
- `useQuery` with key `["admin-checks", statusFilter]` — refetches on filter change
- `depositMutation` calls `adminApi.depositCheck`, invalidates `["admin-checks"]` prefix on success
- `returnMutation` calls `adminApi.returnCheck({ checkId, notes })`, same invalidation
- Check cards: customer name, amount + currency, bank name, due date, status badge (warning/success/destructive)
- Pending cards: Deposit + Return buttons; Deposited: Return only; Returned: no buttons (hidden, not disabled)
- Deposit action: `ConfirmationDialog` (simple confirm, no extra fields)
- Return action: raw `Dialog` with `Textarea` for optional notes + financial impact description
- Loading: 3 skeleton cards; Empty: `EmptyState preset="no-data"`

**`frontend/src/components/Admin/index.tsx`**
- Added `FileCheck2` import from lucide-react
- Imported `AdminChecksView` from `./AdminChecksView`
- Extended `AdminView` union with `"checks"`
- Added 5th nav item: `{ icon: FileCheck2, label: t("nav.checks"), value: "checks" }` (at position 3, between Products and Customers)
- Added `"checks"` to `isMainView` array (bottom nav renders on Checks screen)
- Added `case "checks": return <AdminChecksView />;` to `renderView()` switch

### Task 2: Status badges in StatementViews + locale keys

**`frontend/src/components/Sales/StatementView.tsx`**
- Added check status badge after currency badge, before time span
- Guards: `tx.type === "Payment_Check" && tx.status` (Check_Return entries have null status per Pitfall 7)
- Badge variants: Pending→warning, Deposited→success, Returned→destructive

**`frontend/src/components/Customer/StatementView.tsx`**
- Same check status badge added after currency badge, before is_draft badge
- Same guard condition

**`frontend/src/locales/en.json`** + **`frontend/src/locales/ar.json`**
- Added `nav.checks` key (EN: "Checks", AR: "الشيكات")
- Added `checks` namespace with 20 keys each: title, filter pills, action labels, dialog titles/descriptions, toast messages, status sub-keys (Pending/Deposited/Returned)

## Verification

- `bunx tsc --noEmit` — passes cleanly (0 errors)
- `bun run build` — succeeds in 11.32s

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `frontend/src/components/Admin/AdminChecksView.tsx` — FOUND
- `frontend/src/services/adminApi.ts` — FOUND (contains getChecks)
- `frontend/src/components/Admin/index.tsx` — FOUND (contains "checks")
- `frontend/src/locales/en.json` — FOUND (contains checks namespace)
- `frontend/src/locales/ar.json` — FOUND (contains checks namespace)
- Commit 2a968d0 (Task 1) — FOUND
- Commit 94fc728 (Task 2) — FOUND
