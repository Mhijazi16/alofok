# Phase 8: Check Lifecycle Management - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can advance check status from Pending to Deposited, and mark any non-terminal check as Returned (re-debiting the customer balance). The UI prevents invalid transitions, and the backend rejects invalid transition requests with a 409. Check status is visible across admin check list, sales rep statement, and customer portal.

</domain>

<decisions>
## Implementation Decisions

### Admin Check List
- New "Checks" tab added to admin bottom nav (alongside Overview, Products, Customers, Profile)
- Dedicated top-level check management view — not nested inside customer detail
- Filter by status using tab/pill filters: All | Pending | Deposited | Returned — default to Pending (checks needing action)
- Each check card shows: customer name, amount, currency, bank name, due date, status badge — compact card layout
- No batch operations — one check at a time, each card has its own action button

### Status Transition UX
- Inline action buttons visible on each check card (Deposit button for Pending, Return button for Pending/Deposited)
- Always show a confirmation dialog before executing any transition (both Deposit and Return)
- Hide invalid action buttons entirely — don't show disabled/grayed-out buttons for invalid transitions
  - Pending → shows Deposit + Return buttons
  - Deposited → shows Return button only
  - Returned → no action buttons
- All lifecycle actions (Deposit and Return) are Admin-only — Sales reps have no check lifecycle actions in their UI

### Check Visibility
- Semantic badge colors: Pending = yellow/amber, Deposited = green, Returned = red/destructive
- Check status badges visible in Sales rep StatementView (read-only, no actions)
- Check status badges visible in Customer portal StatementView
- Returned checks appear as two separate statement entries (original payment with "Returned" badge + Check_Return re-debit as separate positive entry) — this matches existing backend behavior

### Return Details
- Return confirmation dialog includes optional notes text field (not mandatory)
- Confirmation dialog shows financial impact: "This will re-debit [amount] [currency] to [customer name]'s balance"
- After returning a check, admin stays in the check list (returned check updates to "Returned" badge in place)
- No notifications to sales reps — they see status changes when viewing customer statement

### Claude's Discretion
- Card layout details (spacing, typography, shadows)
- Loading states and skeletons for the check list
- Error state handling for failed transitions
- Sort order within filtered check list (by date, by amount, etc.)
- Exact confirmation dialog wording and layout
- Search/filter within check list (if useful)

</decisions>

<specifics>
## Specific Ideas

- Filter pills should match the day switcher pill pattern already used in RouteView
- Check cards should be similar in style to existing order/transaction cards in the app
- The "Checks" nav tab sits alongside existing: Overview, Products, Customers, Profile

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Badge` component (frontend/src/components/ui/badge.tsx): Has variant props — use "warning" for Pending, "success" for Deposited, "destructive" for Returned
- `Card`/`CardContent` components: Used throughout admin panel for list items
- `Dialog`/`ConfirmationDialog`: Existing confirmation dialog pattern used for order confirmations
- `BottomNav` component: Already in admin panel — add "Checks" tab item
- `Tabs`/`TabsTrigger`: Can be used for status filter pills (used in StatementView already)
- `Textarea` component: For optional return notes

### Established Patterns
- Admin views follow switch/case pattern in `AdminPanel.index.tsx` with `AdminView` type union
- Backend services follow repository pattern: `PaymentService` → `TransactionRepository`
- `HorizonException` for structured error responses (409 for invalid transitions)
- `TransactionStatus` enum already has Pending, Deposited, Returned, Cleared values
- `TransactionType.Check_Return` type already exists for returned check re-debit transactions

### Integration Points
- Backend `PaymentService.return_check()` already handles return logic — needs `deposit_check()` added
- Backend `payments.py` router needs new deposit endpoint
- Admin panel `index.tsx` needs new "checks" view case and nav item
- `adminApi.ts` needs check list endpoint and deposit/return actions
- `salesApi.ts` already has `returnCheck` method (may need adjustment for admin access)
- StatementView components (Sales + Customer) need status badge rendering for check transactions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-check-lifecycle-management*
*Context gathered: 2026-03-04*
