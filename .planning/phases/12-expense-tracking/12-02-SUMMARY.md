---
phase: 12-expense-tracking
plan: 02
subsystem: ui
tags: [react, expense, lucide, tanstack-query, i18n, shared-component]

requires:
  - phase: 12-expense-tracking plan 01
    provides: Expense model, ledger endpoints (POST /ledger/expenses, GET /ledger/my-expenses, DELETE /ledger/expenses/:id)
provides:
  - Shared ExpenseCard component with expandable card, category grid dialog, CRUD
  - REP_CATEGORIES and ADMIN_CATEGORIES exported category presets
  - salesApi expense functions (createExpense, getMyExpenses, deleteExpense)
  - Expense locale keys in ar.json and en.json (9 categories + UI strings)
affects: [12-expense-tracking]

tech-stack:
  added: []
  patterns: [shared-component-with-role-categories, expandable-card-pattern]

key-files:
  created:
    - frontend/src/components/shared/ExpenseCard.tsx
  modified:
    - frontend/src/services/salesApi.ts
    - frontend/src/components/Sales/RouteView.tsx
    - frontend/src/components/Admin/DailyCashReportView.tsx
    - frontend/src/locales/ar.json
    - frontend/src/locales/en.json

key-decisions:
  - "Outgoing section in DailyCashReportView renders unconditionally so admin ExpenseCard is always visible"
  - "ExpenseCard placed above search bar in RouteView (between stats row and customer search)"

patterns-established:
  - "Shared component pattern: role-specific behavior via props (categories array, isAdmin flag)"
  - "Expense card uses expandable collapsible card with inline dialog for creation"

requirements-completed: [EXP-01, EXP-02, EXP-03, EXP-04, EXP-05]

duration: 3min
completed: 2026-03-06
---

# Phase 12 Plan 02: Expense Frontend Summary

**Shared ExpenseCard component with category grid dialog, wired into Sales RouteView (5 rep categories) and Admin DailyCashReportView (10 admin categories) with full CRUD and bilingual localization**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T13:40:35Z
- **Completed:** 2026-03-06T13:43:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built shared ExpenseCard component with expandable card, expense list with status badges, add dialog with colored category icon grid, amount input, date picker, and notes
- Added createExpense, getMyExpenses, deleteExpense functions to salesApi.ts using LedgerEntry type from adminApi
- Wired ExpenseCard into Sales RouteView (REP_CATEGORIES, 5 categories) above the customer search
- Wired ExpenseCard into Admin DailyCashReportView (ADMIN_CATEGORIES, 10 categories) at top of outgoing section
- Added 18 expense locale keys to both ar.json and en.json (9 category names + 9 UI strings)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add expense API functions, build ExpenseCard component, and add locale keys** - `b1b16f9` (feat)
2. **Task 2: Wire ExpenseCard into RouteView and DailyCashReportView** - `56004d0` (feat)

## Files Created/Modified
- `frontend/src/components/shared/ExpenseCard.tsx` - Self-contained expandable expense card with category grid dialog, CRUD mutations, and query invalidation
- `frontend/src/services/salesApi.ts` - Added createExpense, getMyExpenses, deleteExpense API functions
- `frontend/src/components/Sales/RouteView.tsx` - Imported and rendered ExpenseCard with REP_CATEGORIES above search
- `frontend/src/components/Admin/DailyCashReportView.tsx` - Imported and rendered ExpenseCard with ADMIN_CATEGORIES in outgoing section
- `frontend/src/locales/en.json` - Added expense.* namespace with 18 English keys
- `frontend/src/locales/ar.json` - Added expense.* namespace with 18 Arabic keys

## Decisions Made
- Outgoing section in DailyCashReportView renders unconditionally so admin ExpenseCard is always visible even when no outgoing ledger entries exist
- ExpenseCard placed between stats row and search bar in RouteView for quick access without scrolling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DailyCashReportView outgoing section conditional rendering**
- **Found during:** Task 2
- **Issue:** Outgoing section was wrapped in `{hasOutgoing && ...}` which would hide the ExpenseCard when no outgoing entries exist
- **Fix:** Made outgoing section render unconditionally, wrapped only the `report.outgoing.map()` in hasOutgoing check
- **Files modified:** frontend/src/components/Admin/DailyCashReportView.tsx
- **Verification:** tsc --noEmit and vite build both pass
- **Committed in:** 56004d0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix to ensure admin expense card is always visible. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Expense frontend complete, ready for Phase 13 (Offline Caching) or remaining Phase 12 plans
- ExpenseCard invalidates both `["my-expenses"]` and `["daily-ledger"]` query keys ensuring data consistency

---
*Phase: 12-expense-tracking*
*Completed: 2026-03-06*
