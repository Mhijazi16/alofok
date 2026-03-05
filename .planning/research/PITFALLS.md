# Pitfalls Research

**Domain:** Wholesale trading app — v1.2 Business Operations (expense tracking, cash reconciliation, offline caching, purchase from customer, weighted-average costing, PDF export)
**Researched:** 2026-03-05
**Confidence:** HIGH (codebase inspected directly; patterns verified against existing v1.0/v1.1 architecture; informed by v1.1 pitfalls precedent)

---

## Critical Pitfalls

### Pitfall 1: Expense Transactions Polluting Customer Statements and Balance Queries

**What goes wrong:**
If `Expense` records are added to the existing `transactions` table as new `TransactionType` values (`Expense_Field`, `Expense_Business`), every query that currently iterates "all transactions for a customer" will start including expense rows unless every query is updated. The customer statement query uses `WHERE customer_id = :id` — expense rows attached to a `customer_id` of `NULL` or a pseudo-customer will either fail FK constraints or slip through aggregations. Even worse: admin queries using raw SQL (`SUM(amount)`, `COUNT(type IN (...)`) without filtering for the new type will over- or under-count, silently corrupting EOD totals and sales stats.

**Why it happens:**
Developers extend the STI (Single Table Inheritance) transactions table because it exists and has all the right columns (`amount`, `created_by`, `currency`, `data`). The impulse is to avoid a new migration for a new table. But the existing queries are written assuming the finite set of `TransactionType` values from v1.0, and adding values breaks the assumption without breaking any type check.

**How to avoid:**
- Create a separate `expenses` table with its own model (`id`, `created_by`, `type` as `Enum[field, business]`, `amount`, `currency`, `category`, `notes`, `receipt_url`, `data` JSONB, `BaseMixin` for soft deletes). Do not reuse `transactions`.
- The benefit is zero-risk isolation: no existing query touches the expenses table. Customer balance calculations, statements, EOD reports, and sales stats are unaffected by definition.
- Downside: a new admin dashboard widget for expenses cannot join transactions and expenses in a single query — accept this; build the expense summary endpoint separately.
- If a shared table is truly required, add a column `is_expense BOOLEAN DEFAULT FALSE` and filter `WHERE is_expense = FALSE` in all existing queries before adding any expense rows. This is risky; a separate table is better.

**Warning signs:**
- Expense rows appearing in customer statement views.
- `grand_total_collected` in EOD report changing unexpectedly after adding an expense.
- SQLAlchemy Enum type error when running Alembic upgrade because `transactiontype` Postgres enum doesn't include new values.
- `created_by` required but nullable FK `customer_id` is violated.

**Phase to address:** Phase 1 — Database indexes + expense model foundation. The data model decision must be locked before any endpoint is built.

---

### Pitfall 2: Weighted-Average Cost Calculation on Nullable purchase_price

**What goes wrong:**
`Product.purchase_price` is `Numeric(12, 2) | None`. When implementing "purchase from customer" (reverse order that increases stock and updates purchase price), developers compute the new weighted average as:

```
new_avg = (old_qty * old_purchase_price + purchase_qty * purchase_price) / (old_qty + purchase_qty)
```

If `old_purchase_price` is `None` (never set), this raises `TypeError` in Python or returns `NULL` in a PostgreSQL expression. If `stock_qty` is `None`, the denominator is wrong. Both fields are nullable in the current schema, and many products have `NULL` for both because they were created before inventory tracking was added.

**Why it happens:**
The code path for "first purchase ever" (both columns NULL) is easy to forget during the happy-path implementation. Testing is done with a product that already has both values set.

**How to avoid:**
- In the service layer, always treat `None` as zero for both fields before computing:
  ```python
  old_qty = product.stock_qty or 0
  old_price = product.purchase_price or Decimal("0")
  ```
- After computing the weighted average, if `old_qty + purchase_qty == 0`, leave `purchase_price` as `None` (nothing purchased).
- Write an explicit test: product with `stock_qty=None`, `purchase_price=None` → purchase 10 units at 5.00 → verify `stock_qty=10`, `purchase_price=5.00`.
- Write a second test: product with `stock_qty=5`, `purchase_price=10.00` → purchase 5 units at 14.00 → verify `stock_qty=10`, `purchase_price=12.00`.
- The "purchase from customer" transaction should store `{quantity, unit_price, weighted_avg_after}` in its JSONB `data` field for auditability.

**Warning signs:**
- `TypeError: unsupported operand type(s) for *: 'NoneType' and 'int'` in purchase service.
- `purchase_price` becoming `0.00` after the first purchase of a product (indicates `None` was treated as 0 in the numerator too).
- `stock_qty` going negative on first purchase (indicates `None` was treated as some other value).

**Phase to address:** Phase 4 — Purchase from customer. Null-handling contract must be in the service, not the caller.

---

### Pitfall 3: Cash Report Treating Foreign Currency Payments as ILS

**What goes wrong:**
The daily cash report aggregates payments for admin confirmation. The existing `create_payment` service stores `amount` as the **ILS equivalent** (converted via `exchange_rate`), but the original currency and raw amount are stored in `currency` and `data->>'exchange_rate'`. A cash report that sums `ABS(t.amount)` for all `Payment_Cash` rows will show the correct ILS total, but will misrepresent the report when an admin wants to see "how much USD cash came in today." Alternatively, if the report groups by `currency` and sums raw amounts, it will double-count or miss the exchange rate conversion depending on how the salesman entered the data.

**Why it happens:**
The existing EOD report (`trigger_eod_report`) groups by `t.currency` and sums `ABS(t.amount)` — but `amount` is already ILS-equivalent, so the USD group will show an ILS value labelled as USD. This bug exists today in the EOD report and will propagate to the cash report if the same pattern is copied.

**How to avoid:**
- The cash report must expose both the original currency amount and the ILS equivalent. Source from:
  - `t.currency` — the currency the salesman selected
  - `t.data->>'exchange_rate'` as `exchange_rate` (JSONB)
  - `ABS(t.amount)` as `ils_equivalent` — this is always ILS per the payment service
  - `ABS(t.amount) / exchange_rate` as `original_amount` — reconstruct the raw currency amount
- In the cash report summary, group by `currency` and show both subtotals: total ILS equivalent and total in native currency.
- Add a comment in the payment service that `amount` is always ILS regardless of `currency` field, so future developers don't re-derive from the wrong field.
- Fix the existing EOD report's currency grouping in the same phase.

**Warning signs:**
- Cash report shows "50 USD" but the actual cash is "187 ILS."
- `SUM(ABS(amount)) GROUP BY currency` producing different results than expected.
- `exchange_rate` missing from `data` for some Payment_Cash rows (happens when admin manually enters ILS cash; `exchange_rate` is only stored for non-ILS).

**Phase to address:** Phase 2 — Daily cash report. Clarify the currency storage convention in a code comment first, then build the report against the correct fields.

---

### Pitfall 4: Payment Confirmation Corrupting Balance If Applied Twice

**What goes wrong:**
The admin "daily cash report" flow includes a "confirm receipt" action — admin marks a payment as confirmed (cash received from salesman). If confirming a payment triggers any balance adjustment (e.g., to flag a discrepancy), running confirm twice (network retry, double-click, stale React Query cache showing unconfirmed state) will apply the adjustment twice and corrupt the customer's balance or a cash reconciliation ledger.

**Why it happens:**
Confirmation UI is optimistic — the button stays visible briefly after first click while the request is in flight. Double-click is easy, especially on mobile. Backend idempotency is not the default posture in this codebase (see `create_payment` — it has no idempotency key).

**How to avoid:**
- The "confirm receipt" action should be a state transition on the payment record, not a side-effecting balance mutation. Store a `confirmed_at` timestamp and `confirmed_by` user ID on the transaction (add to `data` JSONB or add columns).
- The endpoint must be idempotent: if `confirmed_at` is already set, return 200 with the current state without re-applying any side effects.
- In the backend: `if txn.data and txn.data.get("confirmed_at"): raise HorizonException(409, "Already confirmed")`.
- In the frontend: disable the confirm button immediately on first click (optimistic disable, not optimistic state change); only re-enable on error.
- Do not use optimistic updates for financial confirmation state — wait for server round-trip.

**Warning signs:**
- No idempotency check in the confirmation endpoint.
- Optimistic update on confirm button that shows "confirmed" before server response.
- Balance difference between transaction sum and `customers.balance` after a day of confirmations.

**Phase to address:** Phase 2 — Daily cash report with confirmation. Idempotency guard must be in the service before the endpoint is wired up.

---

### Pitfall 5: Offline Catalog Cache Serving Stale Prices After Admin Updates

**What goes wrong:**
The catalog is cached in React Query and in the backend Redis for 10 minutes. Extending offline support means products are also stored in IndexedDB. When an admin updates a product's price or marks it out-of-stock, the Redis cache is invalidated immediately (catalog service already does this). But the IndexedDB catalog cache — which has no TTL mechanism built into the current `syncQueue.ts` — is never invalidated. A salesman working offline for hours then online for a few minutes will have React Query show fresh prices (from the server) but the IndexedDB catalog will still serve the old price when they go offline again, unless the IndexedDB hydration is triggered on every successful API fetch.

**Why it happens:**
The existing offline sync is write-focused (sync queue for orders/payments) — it does not cache read data offline. Extending it for catalog reads requires a fundamentally different pattern: read-through caching with invalidation. Developers often implement the hydration step but forget the freshness check.

**How to avoid:**
- Store the catalog in IndexedDB with a `cached_at` timestamp. On app load, if `now - cached_at > 30 minutes` (or when the device comes online), fetch the catalog from the server and update IndexedDB.
- Use React Query's `staleTime` and `gcTime` settings for the in-memory layer; use a separate `catalogCache` module (similar to `syncQueue.ts`) for the IndexedDB layer.
- Hydrate IndexedDB whenever a successful API response for `GET /catalog` is received — use React Query's `onSuccess` (or `select` + `useEffect`) to write to IndexedDB.
- The catalog IndexedDB store should be a single record with `{products: [...], cached_at: ISO_STRING}`, not individual rows per product — simpler to invalidate atomically.
- Add a `VERSION` bump to IndexedDB (currently at v2) when adding the `catalog_cache` store: v3.

**Warning signs:**
- Product price shown in offline order differs from server price.
- IndexedDB `catalog_cache` store has no `cached_at` field.
- React Query staleTime for catalog is `Infinity` (never re-fetches on reconnect).
- IndexedDB version is still 2 after adding the catalog store.

**Phase to address:** Phase 3 — Offline catalog and route caching. Catalog cache invalidation strategy must be designed before implementation.

---

### Pitfall 6: Offline Route Cache Including Deleted or Reassigned Customers

**What goes wrong:**
The route data (customers assigned to a salesman's day, their pending orders) is cached for offline use. When a customer is reassigned to a different salesman or soft-deleted (`is_deleted = True`), the change is in the database immediately, but the offline route cache in IndexedDB still includes the old data. A salesman who was offline during the reassignment will see the customer on their route and attempt to take an order — the order creation will succeed locally (queued in IndexedDB), then fail on sync with a 403 (customer not assigned to this rep) or 404 (customer soft-deleted). The sync queue will be stuck because the same item keeps failing.

**Why it happens:**
Offline route data is fetched once per day at start of shift. Admin reassignments happen at any time. The two systems have no shared invalidation channel. The current sync queue breaks on first error and retries indefinitely — it does not distinguish between retryable errors (network timeout) and permanent failures (403, 404).

**How to avoid:**
- The sync flush must handle permanent failures differently from transient failures. On 4xx (except 429), remove the item from the queue and log the error to a failed-items store, rather than stopping the entire flush. On 5xx or network error, stop and retry.
- Add a "failed sync items" UI indicator so the salesman knows an order was not submitted (rather than silently losing it).
- Route cache should include a `cached_at` timestamp and auto-refresh when the app comes online (same as catalog cache).
- For customer soft-deletes specifically, the route data should be re-fetched when the app detects it has been offline for more than 30 minutes. Store `last_fetched_at` and compare on app foreground.

**Warning signs:**
- `syncQueue` flush stops processing all items on first 403 (the current `break` on error in `useOfflineSync.ts`).
- No distinction between permanent failures (4xx) and transient failures (5xx/network) in flush error handling.
- No "failed items" store or UI to surface permanently rejected queue items.
- Route data fetched once at login and never refreshed during the session.

**Phase to address:** Phase 3 — Offline route caching. Fix the sync flush error-handling strategy before adding more queue item types.

---

### Pitfall 7: PDF Generation Blocking the Async Event Loop

**What goes wrong:**
Server-side PDF generation (e.g., using `weasyprint` or `reportlab`) for customer statements is CPU-intensive and synchronous. In a FastAPI async context, running a synchronous PDF renderer directly in an async endpoint will block the entire event loop for the duration of rendering — all other requests queue up behind it. A complex statement with 500 transactions and Arabic text rendering can take 2–8 seconds, effectively making the server unresponsive.

**Why it happens:**
FastAPI's async endpoints use a single event loop per worker. Calling a synchronous function directly from async code does not offload it — it blocks the loop. `asyncio.to_thread()` or `run_in_executor()` is required but not obvious to developers coming from synchronous web frameworks.

**How to avoid:**
- If using server-side PDF generation: wrap the renderer call in `asyncio.to_thread(generate_pdf, params)` so it runs in a thread pool and does not block the event loop.
- Alternative (recommended): generate the PDF client-side using a JavaScript PDF library (`@react-pdf/renderer` or `jsPDF`). The statement data is already fetched for the statement view — pass it to the PDF renderer in the browser. This avoids the server-side blocking problem entirely and works offline (the cached statement data can be PDFed without an API call).
- For Arabic RTL PDF: `@react-pdf/renderer` supports RTL via the `direction` prop on `View`/`Text` components and embedding Arabic fonts. `jsPDF` RTL support is weaker — requires manual text reversal. Prefer `@react-pdf/renderer`.
- Do not use `weasyprint` in a Docker container without pre-installing the font packages and Pango libraries — missing fonts silently produce boxes instead of Arabic text.

**Warning signs:**
- PDF endpoint is an `async def` that calls a synchronous renderer without `asyncio.to_thread`.
- Arabic characters in PDF appear as rectangles (missing font).
- PDF generation endpoint has no timeout guard (if rendering hangs, request stays open indefinitely).
- Client-side PDF memory usage exceeds 500 MB for large statements (symptom of not virtualizing the data before passing to renderer).

**Phase to address:** Phase 5 — PDF export. Architecture decision (server-side vs client-side) must be made in planning, not mid-implementation.

---

### Pitfall 8: Purchase-from-Customer Transaction Not Flagged Separately in Statements

**What goes wrong:**
A "purchase from customer" is a reverse order — the customer sells goods to the company, reducing their balance (a credit, not a debit). If implemented as a new `TransactionType.Purchase` with a negative amount (same sign as a payment), it will appear in customer statements as if the customer made a cash payment. Sales reps and customers viewing their statement will be confused. The statement view's label lookup (`type → display name`) will either show `undefined` (missing locale key) or show the wrong label.

**Why it happens:**
The signed-amount convention (`positive = order/debt, negative = payment/credit`) is correct for purchase transactions, but the display layer uses `type` to show the label, not the sign. Adding a new type without adding locale keys (`en.json`, `ar.json`) causes `undefined` in the UI immediately.

**How to avoid:**
- Add `Purchase = "Purchase"` to `TransactionType` enum in the model.
- Add Alembic migration to extend the `transactiontype` Postgres enum (ALTER TYPE ... ADD VALUE).
- Add locale keys for "Purchase" in both `ar.json` (`شراء`) and `en.json` (`Purchase`) before building any UI.
- In the statement view, purchase transactions should render with a distinct color or icon (e.g., green background, "IN" arrow) so they are visually different from cash payments — they have the same sign but different business meaning.
- The stock increase and purchase price update must happen in the same database transaction as the `Transaction` creation — if the stock update fails, the financial transaction must not be committed.

**Warning signs:**
- `type → label` mapping in statement view returns `undefined` or "Unknown" for purchase rows.
- `stock_qty` and `purchase_price` updated in a separate request after the transaction is committed (inconsistency risk if the second request fails).
- Purchase appears in the statement identically to a cash payment with no label or icon difference.
- Admin EOD report includes purchase amounts in "total collected" (wrong — purchases are not cash collections).

**Phase to address:** Phase 4 — Purchase from customer. Enum extension, locale keys, and atomicity of stock update must all happen in Phase 4 before UI.

---

### Pitfall 9: Redis Cache Returning Stale Catalog After Purchase Updates Stock

**What goes wrong:**
When a purchase-from-customer transaction increases `product.stock_qty`, the catalog cache in Redis (`catalog:list`) is **not** invalidated because the purchase service writes to the `products` table but does not call `CatalogService` (which owns cache invalidation). The catalog endpoint continues serving the old `stock_qty` for 10 minutes. Salesmen will see products as in-stock when they are not, or vice versa.

**Why it happens:**
Cache invalidation is centralized in `CatalogService.update_product()` and `delete_product()`. Any other service that directly modifies product fields bypasses this invalidation. A purchase service that `SELECT`s and updates a product record directly will not call the cache invalidation path.

**How to avoid:**
- The purchase service must not modify products directly. Instead, call `CatalogService.update_product()` (or a narrower `update_stock()` method on `ProductRepository` followed by explicit `cache.invalidate_prefix("catalog:")`) after the purchase transaction is committed.
- Alternatively, add a method to `CatalogService` — `adjust_stock(product_id, delta, new_purchase_price)` — that handles the stock update and cache invalidation atomically.
- In the purchase service, structure the operation as: (1) create `Transaction` with `type=Purchase`, (2) call `catalog_service.adjust_stock(...)`, (3) commit. If step 2 fails, roll back step 1.
- Add a test: after a purchase, call `GET /catalog` and verify `stock_qty` reflects the purchase.

**Warning signs:**
- Purchase service imports `ProductRepository` directly and calls `update()` without touching `CacheBackend`.
- Redis key `catalog:list` has a TTL of 600 seconds after a purchase updates `stock_qty`.
- Integration test for purchase does not verify the catalog endpoint response.

**Phase to address:** Phase 4 — Purchase from customer. Cache invalidation path must be explicit in the service design before implementation.

---

### Pitfall 10: Custom Date Intervals in Statements Breaking the "Since Zero Balance" Toggle

**What goes wrong:**
The existing customer statement API supports a `since_zero` boolean — it finds the last date the customer had a zero balance and returns all transactions from that date forward, ignoring the `start_date`/`end_date` parameters. When a custom date range picker is added, users can select a range that conflicts with `since_zero`. If the frontend sends both `since_zero=true` and custom `start_date`/`end_date`, the backend must define which takes precedence. Currently, `since_zero` overrides everything — users will select a custom range, the backend ignores it, and the PDF exports the wrong date range silently.

**Why it happens:**
The `since_zero` feature was added before custom date ranges, and its precedence was never documented. When custom date ranges are added, the developer adds query parameters without revisiting the precedence logic.

**How to avoid:**
- Define the precedence rule explicitly in code and docs: `since_zero=true` overrides custom date range (since_zero is conceptually "from whenever makes sense to now"). The UI should disable the date range picker when `since_zero` is checked — don't allow both simultaneously.
- In the backend, if `since_zero=true`, ignore `start_date`/`end_date` and log a warning if they were provided (indicator of a frontend bug).
- The PDF export must use the same parameters as the statement view — pass the same `since_zero` flag and date range to the PDF renderer so what the user sees matches what they export.
- Add locale keys for custom date range labels in both `ar.json` and `en.json`.

**Warning signs:**
- Frontend sends `since_zero=true&start_date=2026-01-01` simultaneously.
- PDF export shows different transactions than the statement view for the same customer.
- Date range picker is enabled even when `since_zero` toggle is on.

**Phase to address:** Phase 5 — Custom date range + PDF export. Define the precedence rule before touching the statement endpoint.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Adding `Expense_Field` / `Expense_Business` to `TransactionType` instead of separate table | Reuses existing transaction infrastructure | Every existing query must be audited and updated; admin stats silently wrong | Never — separate table is the correct call |
| Skipping `asyncio.to_thread` for PDF generation | 5-line server-side PDF call | Event loop blocked for 2–8 seconds per request; server unresponsive | Never in production; acceptable in a local admin-only tool with 1 user |
| `stock_qty` update in a separate request after transaction commit | Simpler code path | Inconsistent stock count if second request fails; no atomicity | Never for financial + inventory operations |
| Treating `None` stock_qty as 0 without explicit null handling | Avoids boilerplate | Silent wrong weighted average on first purchase of a product | Never — write the explicit guard |
| Copying EOD report SQL for cash report without fixing currency grouping bug | Fast to ship | Cash report shows wrong per-currency subtotals from day one | Never — fix the bug first |
| Not adding locale keys before building purchase UI | Defer internationalization | `undefined` or raw enum string shown to Arabic users in production | Never — locale keys take 5 minutes |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@react-pdf/renderer` with Arabic text | No font embedding; renders rectangles | Load and register an Arabic font (e.g., Amiri or Cairo) via `Font.register()` before using `<Text>` in RTL |
| `@react-pdf/renderer` RTL | Forgetting `direction="rtl"` on root `<View>` | Set `direction: "rtl"` in the style of the root View; all nested text then renders RTL correctly |
| IndexedDB v3 upgrade (adding catalog_cache store) | Missing `onupgradeneeded` branch for existing v2 installs | `onupgradeneeded` fires for BOTH new installs and upgrades; check `e.oldVersion` to conditionally create stores |
| Alembic `ALTER TYPE ... ADD VALUE` for new TransactionType | SQLite-style migration; Postgres enum extension does not support rollback | Add `IF NOT EXISTS` to the ADD VALUE statement; mark the migration as non-reversible in the `downgrade()` function |
| React Query + PDF trigger | Using `useQuery` for PDF generation (GET endpoint) | PDF generation is a user action, not a data fetch; use `useMutation` or a direct `fetch()` call triggered by button click |
| Expense category as free text vs. enum | Free text is flexible; mismatched categories make admin reporting useless | Use a fixed enum (`transportation`, `meals`, `supplies`, `other`) with a free-text `notes` field for specifics |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full statement loaded into memory for PDF | Browser tab crashes or freezes on customers with 1000+ transactions | Paginate the data fetch; PDF renderer streams pages rather than building entire document in memory | Any customer with >500 transactions |
| Catalog IndexedDB hydration on every render | `openDB()` called per component mount; noticeable lag on route view | Open DB once on app init; use a module-level singleton or React context for the DB handle | From first implementation if done naively |
| Weighted-average update in a loop (batch purchases) | If purchase creates multiple product records, per-row UPDATE causes N round trips | Accumulate updates in a dict, apply all in one `UPDATE ... SET` call or use `session.flush()` once | Batch purchases of >10 distinct products |
| No database index on `transactions.type` + `created_by` for cash report query | Cash report query scans entire transactions table; noticeable at 10k+ rows | Phase 1 is explicitly adding indexes — `CREATE INDEX ... ON transactions(type, created_by, created_at)` must be in that migration | Already slow at current scale per PROJECT.md note |
| PDF rendered client-side with all statement data at once | React render hangs for 3–5 seconds while `@react-pdf/renderer` builds DOM | Generate PDF in a Web Worker or use `PDFViewer` lazy-loaded only after user clicks "Export" | Any statement with >200 line items |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Expense receipt image served from `/static` with predictable path | Any authenticated user can access another employee's receipt by guessing UUID (same risk as check images) | Generate UUID filenames; add authorization check — only the expense creator or Admin can fetch a receipt |
| Admin cash report endpoint accessible by Sales role | Salesman sees other reps' collected amounts; salary-sensitive | Guard cash report endpoint with `Admin`-only RBAC; Sales reps only see their own daily summary via existing EOD pattern |
| PDF export endpoint returning another customer's statement via IDOR | Salesman exports `?customer_id=OTHER_ID` to see competitor's balance | Validate that the requesting Sales rep is `assigned_to` the customer; Admin can export any |
| Expense amount without upper bound validation | Salesman submits expense of 9,999,999 ILS; passes validation | Add `max_value` validation (e.g., `amount <= 50000 ILS`) with a meaningful error message; large expenses require Admin role |
| Purchase-from-customer with negative quantity or price | `stock_qty` goes negative; `purchase_price` becomes negative | Validate `quantity > 0` and `price > 0` in the Pydantic schema, not just in the service |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Cash report with no "pending confirmation" vs "confirmed" visual distinction | Admin cannot tell which payments still need action | Use color-coded rows: yellow = pending confirmation, green = confirmed, red = flagged/discrepancy |
| Expense form with no receipt photo optional indicator | Salesmen skip receipt upload because it seems required | Mark receipt as "(optional)" in the label; do not block submission without a receipt |
| Custom date range picker defaulting to today→today on open | User must always adjust both dates manually | Default to the current month-to-date (first of month → today) as the pre-selected range |
| PDF export button inside the statement view with no loading state | User taps "Export PDF" and nothing happens for 3 seconds; taps again | Show a spinner or disable the button immediately; display "Preparing PDF…" toast |
| Purchase from customer form using the same flow as order creation | Sales rep confused about direction of transaction (who owes what) | Clearly label the purchase form "Buying from customer" / "شراء من العميل" with a description that the customer's balance will decrease |
| Offline indicator not distinguishing "no internet" from "syncing" | User doesn't know if their queued data is being sent | Three states: online (no indicator), offline (orange banner + count), syncing (spinner + "uploading X items") |

---

## "Looks Done But Isn't" Checklist

- [ ] **Expense model isolation:** Verify that `GET /customers/{id}/statement` returns zero expense rows after adding 5 test expenses.
- [ ] **Weighted-average first purchase:** Test with `stock_qty=NULL, purchase_price=NULL` — verify no exception and correct result.
- [ ] **Cash report currency accuracy:** Enter a 100 USD payment with exchange rate 3.7 → verify cash report shows "100 USD / 370 ILS", not "100 ILS."
- [ ] **Confirmation idempotency:** Call the confirm endpoint twice on the same payment → verify second call returns 409, not 200.
- [ ] **Catalog cache invalidation after purchase:** Purchase 5 units of product X → call `GET /catalog` → verify `stock_qty` reflects the purchase (not the old Redis-cached value).
- [ ] **Offline catalog freshness:** Set catalog IndexedDB to a 2-hour-old timestamp → bring app online → verify catalog is re-fetched from server.
- [ ] **Sync queue permanent failure handling:** Queue an order for a soft-deleted customer → go online → verify the failed item is moved to a failed-items store and the flush continues with remaining items (does not stop at first error).
- [ ] **PDF Arabic rendering:** Export a statement for a customer with an Arabic name → verify Arabic text renders correctly, not as rectangles.
- [ ] **PDF matches statement view:** Export PDF with a custom date range → verify PDF shows the same transactions as the statement view for that range.
- [ ] **Since-zero + custom range mutual exclusivity:** Check that UI disables date range picker when since_zero toggle is on; verify backend ignores date range when since_zero is true.
- [ ] **Purchase TransactionType locale keys:** Switch app to Arabic → navigate to statement for a customer with a Purchase transaction → verify Arabic label "شراء" appears, not `undefined`.
- [ ] **Admin-only cash report RBAC:** Log in as a Sales rep → attempt `GET /admin/cash-report` → verify 403.
- [ ] **Expense receipt IDOR:** Log in as user A → upload a receipt → try to fetch the URL as user B without authorization → verify 403.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Expenses accidentally in transactions table | HIGH | Alembic data migration to move expense rows to new table; update all references; redeploy; verify statement totals |
| Wrong weighted average due to NULL handling | MEDIUM | Write a one-time script to recompute `purchase_price` for all products with `Purchase` transactions; add a migration |
| Cash report wrong currency totals shipped | LOW | Fix the SQL in admin_service; redeploy; no data migration needed |
| Confirmation applied twice corrupting balance | HIGH | Audit all `confirmed_at`-lacking transactions; identify duplicates via `related_transaction_id` pattern; manual balance correction |
| Stale catalog price in IndexedDB causing wrong order amounts | MEDIUM | Release IndexedDB v4 bump that clears catalog_cache store on upgrade; users get a fresh fetch on next app load |
| PDF exported wrong date range | LOW | UI-only fix: enforce mutual exclusivity of since_zero + custom range; no data migration needed |
| Sync queue stuck on permanent 403 failure | MEDIUM | Release flush fix (stop on 5xx, skip on 4xx); add failed-items store; users must re-enter lost queued items manually |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Expenses polluting customer statements | Phase 1: DB indexes + expense model | Integration test: statement endpoint returns 0 expense rows |
| Weighted average on nullable stock_qty/purchase_price | Phase 4: Purchase from customer | Unit tests for NULL + zero stock base cases |
| Cash report multi-currency accuracy | Phase 2: Daily cash report | Manual test with known USD/JOD payment + exchange rate |
| Confirmation double-apply | Phase 2: Daily cash report | Integration test: second confirm call returns 409 |
| Stale offline catalog after stock update | Phase 3: Offline catalog caching | Integration test: catalog endpoint after purchase shows updated stock_qty |
| Offline route cache with deleted customers | Phase 3: Offline route caching | Test: soft-delete customer → sync fails gracefully, does not halt queue |
| PDF event loop blocking | Phase 5: PDF export | Load test: 3 concurrent PDF requests, check response time of other endpoints |
| Purchase not flagged in statement display | Phase 4: Purchase from customer | Statement view test with a Purchase transaction; verify distinct label + color |
| Redis cache stale after purchase stock update | Phase 4: Purchase from customer | Verify `GET /catalog` after purchase returns updated stock_qty |
| since_zero + custom date range conflict | Phase 5: Custom date range + PDF | UI: date range disabled when since_zero active; API: since_zero overrides range |

---

## Sources

- Direct codebase inspection: `/home/ka1ser/projects/alofok/backend/app/services/admin_service.py`, `payment_service.py`, `order_service.py`, `catalog_service.py`, `frontend/src/lib/syncQueue.ts`, `frontend/src/hooks/useOfflineSync.ts`, `backend/app/models/transaction.py`, `backend/app/models/product.py`
- v1.1 PITFALLS.md patterns (same project): IndexedDB versioning, currency storage convention, cache invalidation, sync queue error handling
- PROJECT.md v1.2 milestone context: "Transactions table missing indexes on created_by, type, status" — pre-existing known issue
- CLAUDE.md architectural constraints: signed amounts convention, soft-delete only, Redis TTLs, offline-first priority
- [@react-pdf/renderer documentation — RTL support](https://react-pdf.org/)
- [FastAPI async background tasks and thread pools](https://fastapi.tiangolo.com/async/)
- [Alembic ALTER TYPE for PostgreSQL enum](https://alembic.sqlalchemy.org/en/latest/ops.html)
- [IndexedDB Best Practices — web.dev](https://web.dev/articles/indexeddb-best-practices)
- [Weighted average cost method — accounting reference](https://www.accountingtools.com/articles/what-is-the-weighted-average-cost-method.html)

---
*Pitfalls research for: Alofok v1.2 Business Operations (expense tracking, cash reconciliation, offline caching, purchase from customer, weighted-average costing, PDF export)*
*Researched: 2026-03-05*
