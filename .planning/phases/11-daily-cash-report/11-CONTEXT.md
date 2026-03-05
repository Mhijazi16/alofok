# Phase 11: Daily Cash Report - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can view a daily cash report showing all incoming payments (cash + checks) and all outgoing expenses across all salesmen, navigate between days, and confirm or flag each rep's cash handover. No per-transaction confirmation — only per-rep-per-day confirmation via the `daily_cash_confirmations` table created in Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Report Layout
- Card per rep — each rep gets a glass card showing 4 totals: cash payments, check payments, expenses, and net cash to hand over (cash - expenses)
- Cards are expandable — tap to see individual payment and expense transactions for that rep on that day
- Grand totals bar at the top of the page showing the day's total cash, total checks, total expenses, and grand net across all reps
- Totals are computed on-the-fly from transactions + expenses tables (no snapshot — decided in Phase 10)

### Date Navigation
- Arrow buttons flanking the current date (◀ March 5, 2026 ▶) for quick prev/next day
- Tap the date text to open the existing DatePicker calendar for jumping to specific dates
- Default view: today's date
- Forward arrow disabled when viewing today — no future dates allowed in calendar either
- Navigation does not trigger page reload (client-side state change, new API query)

### Confirmation and Flagging Flow
- Inline on the card: amount input field pre-filled with the computed net, Confirm button, and Flag button directly on each rep's card
- Admin enters the handed-over amount (what the rep physically gave) — compared to the computed net
- When handed-over amount differs from computed net by >5%, the discrepancy is visually highlighted (warning color, percentage shown) but NOT auto-flagged — admin must manually click Flag
- Confirmed state: card shows green/success border, confirmed_at timestamp, confirmer name
- Flagged state: card shows red/destructive border, flag icon next to rep name, flag_notes visible below totals
- Pending state: default card style, no border color
- Allow un-confirm: confirmed cards show a subtle Edit/Undo button to re-open for adjustment
- Flag action requires a notes field (mandatory free-text explaining the discrepancy)

### Nav Placement
- Cash report is a sub-view of the Admin Overview, NOT a new bottom nav item
- Accessed via a stat card on the Overview page showing today's cash summary (e.g. "Daily Cash: ₪12,500")
- Cash report view has a back button (top-left arrow) to return to Overview, same pattern as CustomerDashboard
- Bottom nav remains visible with Overview as active item
- New AdminView type value: "cashReport"

### Claude's Discretion
- Exact stat card design on Overview (icon, label, value format)
- Loading and empty states for the cash report
- Exact styling of the expandable transaction list inside rep cards
- API endpoint naming and response shape
- How to handle multi-currency payments in the report (ILS/USD/JOD) — show breakdown or convert

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card`, `CardContent` (ui/card): Glass variant for rep cards
- `DatePicker` (ui/date-picker): Already exists, used in order confirmation dialog
- `Badge` (ui/badge): For status labels (Pending/Confirmed/Flagged)
- `Button` (ui/button): Confirm, Flag, Edit buttons
- `Separator` (ui/separator): Between card sections
- `Dialog` (ui/dialog): If needed for flag notes input
- `StatCard` (ui/stat-card): For the Overview access point
- `PageContainer` (layout/page-container): Wrap the report view
- `useToast` hook: For confirmation/flag success feedback
- `adminApi` service: Add new endpoints here
- `DailyCashConfirmation` model (backend): Created in Phase 10, ready to use

### Established Patterns
- Admin view switching via `AdminView` type + `renderView()` switch statement in `index.tsx`
- Sub-views accessed by setting `activeView` state (e.g., "sales", "debt", "checks")
- Back navigation pattern: `onBack` prop calling `setActiveView("overview")`
- React Query for data fetching (`useQuery` with query keys)
- Backend: `api/endpoints/` → `services/` → `repositories/` layered architecture
- Backend: Pydantic schemas in `schemas/` for request/response typing

### Integration Points
- `frontend/src/components/Admin/index.tsx`: Add "cashReport" to AdminView type, add case to renderView(), add stat card to Overview
- `frontend/src/components/Admin/Overview.tsx`: Add stat card linking to cash report
- `frontend/src/services/adminApi.ts`: Add API calls for daily cash data
- `backend/app/api/endpoints/admin.py`: Add cash report endpoint(s)
- `backend/app/services/admin_service.py`: Add cash report aggregation logic
- `backend/app/schemas/admin.py`: Add response schemas for cash report data
- `backend/app/repositories/transaction_repository.py`: Add query for daily aggregates by rep

</code_context>

<specifics>
## Specific Ideas

- Rep cards should feel like the existing CustomerDashboard cards — glass effect, clean totals, expandable sections
- The date navigation header should feel like a calendar app — centered date with arrow buttons on each side
- Discrepancy highlighting should use the existing warning/destructive color tokens from the design system

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-daily-cash-report*
*Context gathered: 2026-03-05*
