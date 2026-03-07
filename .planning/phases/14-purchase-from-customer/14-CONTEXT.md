# Phase 14: Purchase from Customer - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Sales rep can record buying products back from a customer, which credits the customer's balance (negative signed amount), increases product stock_qty, and recalculates the product's weighted-average purchase_price. Purchases also appear in the Admin's Daily Cash Report as outgoing items.

</domain>

<decisions>
## Implementation Decisions

### Entry Point
- New "Purchase" action button on CustomerDashboard alongside existing Order/Payment/Statement/Check actions
- Any customer can be purchased from — no restrictions by balance or admin flag
- Purchases work offline, queued in sync queue like orders — server resolves WAC on sync
- Icon and color: Claude's discretion (differentiate from red Order button)

### Product Selection UX
- Reuse existing OrderFlow catalog browser with cart pattern (familiar, catalog already cached offline)
- No product options (sizes/colors) — purchases operate at the base product level only
- Rep enters a custom price per item (negotiated buy-back price) — no fixed default needed, field is editable
- WAC formula applied server-side: (old_qty * old_price + new_qty * new_price) / (old_qty + new_qty)
- Selling price is never affected by purchases — only purchase_price changes

### Confirmation & Review
- Simple summary before submit: list of products with qty x price, grand total credit amount
- No WAC preview — keep it clean and quick
- ILS only — no multi-currency support for purchases
- Balance credit only — no cash changes hands. Customer's debt decreases, no physical cash outflow
- Optional notes field on the purchase (same as orders)

### Statement Appearance
- Distinct color (not red/green) + "Purchase" label to differentiate from orders and payments
- Negative signed amount (credits customer, reduces running balance) — consistent with signed-amount convention
- Shows total amount + notes if present — no product breakdown in statement view
- Product details stored in transaction.data JSONB for reference

### Daily Cash Report Integration
- Purchases appear in Admin's Daily Cash Report as outgoing/balance-adjustment items
- Grouped under the rep who created the purchase

### Claude's Discretion
- Purchase button icon and accent color on CustomerDashboard
- Purchase cart UI adaptations (removing option picker, adding price input field)
- Statement line color choice (something distinct from order red and payment green)
- Loading states and error handling
- Offline queue implementation details (reuse existing sync patterns)

</decisions>

<specifics>
## Specific Ideas

- WAC example from user: 5 units at 10 = 50, buy 10 more at 15 = 150, total 200 / 15 units = 13.33 per unit
- Purchase is purely a balance adjustment — no cash leaves the rep's hands
- Admin should see purchases as outgoing in the daily cash report for full daily financial picture

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OrderFlow` component: catalog browser with cart, search, grid/list view — reuse for purchase product selection
- `CartItem` type + `cartKey()` utility: cart state management pattern
- `CustomerDashboard`: action routing via `onAction` callback — add "purchase" action type
- `ConfirmationDialog`: existing pattern for order confirmation — adapt for purchase summary
- `Transaction` model: already has `Purchase` enum value in `TransactionType` (added Phase 10)
- `Product` model: has `purchase_price` (Numeric 12,2) and `stock_qty` (Integer) fields ready

### Established Patterns
- Signed amounts: positive = debt (orders), negative = credit (payments, purchases)
- Transaction.data JSONB: stores structured details (check data, exchange rates) — use for purchase line items
- Sales API service pattern: `salesApi.createOrder()` → adapt to `salesApi.createPurchase()`
- React Query mutations with cache invalidation on success
- Offline sync queue via IndexedDB (Phase 13)

### Integration Points
- `CustomerDashboard.onAction`: add "purchase" to the `CustomerAction` type union
- `Sales/index.tsx`: route "purchase" action to new PurchaseFlow component
- `/orders` router pattern: create `/purchases` router or add to existing orders router
- Daily Cash Report aggregation query: include Purchase type transactions in outgoing section
- Statement view: add Purchase type handling with distinct color

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-purchase-from-customer*
*Context gathered: 2026-03-07*
