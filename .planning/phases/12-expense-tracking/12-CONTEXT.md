# Phase 12: Expense Tracking - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Sales reps can log field expenses and Admin can log business expenses. Admin reviews, confirms, or flags individual expenses. Expenses are stored in the existing `company_ledger` table (direction: 'outgoing') — NOT the separate `expenses` table from Phase 10. Admin manages expenses inline within the existing daily cash report view.

</domain>

<decisions>
## Implementation Decisions

### Storage: company_ledger table
- Expenses stored as `company_ledger` entries with `direction: 'outgoing'`, `payment_method: 'cash'`
- Category stored in the existing `category` string column (not a Postgres enum)
- The separate `expenses` table from Phase 10 is NOT used for this feature
- Expenses automatically appear in the daily cash report's outgoing section (already queried from ledger)

### Sales Rep Expense Entry
- Expandable card on the Route view, positioned ABOVE customers and orders sections
- Collapsed state: shows summary info (today's expense total or similar)
- Tapping expands a dropdown section showing today's expense rows and an "Add" button
- "Add" button opens a popup/dialog with:
  - Colored icon grid for category selection
  - Amount field (ILS only)
  - Date picker (can log for any date, not just today)
  - Optional notes
  - Submit button
- Rep can delete their own expenses from the expanded list
- Admin-submitted expenses auto-set to confirmed status; rep expenses start as pending

### Rep Categories (Field expenses)
- Food, Fuel, Gifts, CarWash, Other
- Each category has a distinct icon and background color in the grid picker

### Admin Categories (Business expenses — superset of rep categories)
- All rep categories PLUS: Electricity, Internet, CarRepair, Salaries, Other
- Same expandable card component reused for admin, with the expanded category set
- Admin accesses expense entry from the same card pattern (location TBD by Claude — could be in cash report or overview)

### Admin Expense Management
- NO separate Expenses tab in Finance — management happens inside the daily cash report
- Individual expense rows in the cash report's expanded rep sections have swipe actions (reuse existing swipeable-card pattern)
- Swipe right to confirm, swipe left to flag (with mandatory notes prompt)
- Same confirm/flag workflow already established in Phase 11 for ledger entries

### Sales Rep Expense History (EXP-04)
- Rep sees their own expenses in the expandable card on Route view
- Status visible per row (pending/confirmed/flagged indicator)

### Claude's Discretion
- Exact icon and color assignments for each category
- Collapsed card summary content (today's total, count, or both)
- Loading and empty states for the expense card
- Admin expense entry placement (in cash report outgoing section or separate card on overview)
- Whether "Other" category prompts for mandatory notes or not
- Exact popup/dialog styling for the add expense form

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CompanyLedger` model (backend): Already has direction, payment_method, category, status, confirm/flag fields — expenses fit directly
- `LedgerEntryOut` schema: Already includes category, status, flag_notes — no changes needed for reading expenses
- `LedgerStatusUpdateIn` schema: Already handles confirm/flag with notes — reusable for expense status changes
- `DailyCashReportView` (frontend): Already shows outgoing ledger entries grouped by rep — expenses will appear here automatically
- `swipeable-card` component: Already implements swipe-to-confirm/flag pattern used in cash report
- `DatePicker` (ui/date-picker): For date selection in the add expense form
- `Dialog/DialogContent` (ui/dialog): For the expense add popup
- `Card` (ui/card): Glass variant for the expandable expense card on Route view
- `useToast` hook: For feedback on expense actions

### Established Patterns
- Ledger service + repository: `ledger_service.py`, `ledger_repository.py` — add expense creation endpoint here
- Admin view switching via `AdminView` type in `index.tsx`
- Route view is the Sales landing page — new expense card goes at the top
- React Query for data fetching with mutation for create/delete
- Backend layered architecture: endpoints -> services -> repositories

### Integration Points
- `frontend/src/components/Sales/RouteView.tsx` or `Sales/index.tsx`: Add expandable expense card above customers/orders
- `backend/app/api/endpoints/ledger.py`: Add POST endpoint for creating expense entries
- `backend/app/services/ledger_service.py`: Add create_expense method
- `backend/app/repositories/ledger_repository.py`: Add expense CRUD
- `frontend/src/services/salesApi.ts`: Add expense API calls
- `frontend/src/components/Admin/DailyCashReportView.tsx`: Expense rows already show as outgoing — add swipe confirm/flag if not already present

</code_context>

<specifics>
## Specific Ideas

- Category picker should be a colored icon grid (like emoji keyboards) — visual and fast for field use
- Expense card on Route view should feel like the customers and orders cards already there — floating above them
- Swipe actions for admin mirror the existing cash report swipe pattern exactly
- Rep and admin share the same expense card component with different category sets

</specifics>

<deferred>
## Deferred Ideas

- Expense receipt photo upload — explicitly out of scope (REQUIREMENTS.md)
- Offline expense submission — tracked as future OFFL-04
- Expense CSV export — not discussed, potential future enhancement

</deferred>

---

*Phase: 12-expense-tracking*
*Context gathered: 2026-03-06*
