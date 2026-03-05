# Feature Research

**Domain:** Wholesale trading app — v1.2 Business Operations milestone
**Researched:** 2026-03-05
**Confidence:** HIGH (existing code audited, patterns established) / MEDIUM (PDF library tradeoffs, WAC formula integration)

---

## Context: What Already Exists

| What exists | Where | Notes |
|-------------|-------|-------|
| Transaction model (Order, Payment_Cash, Payment_Check, Check_Return, Opening_Balance) | `transaction.py` | Signed amounts, JSONB data column |
| Customer balance tracking | `customers.balance` column | Updated on each transaction |
| Admin insights dashboard (sales stats, debt by city, overdue checks) | `admin_service.py` + Admin UI | Date range query, EOD Slack report |
| EOD report via Slack webhook | `admin_service.py.trigger_eod_report` | Per-rep daily summary |
| Customer statement (date range, since-zero toggle, running balance) | `salesApi.ts.getStatement` | `start_date`/`end_date` query params exist |
| Offline sync queue (orders + payments) | IndexedDB + React Query | Server-authoritative, flush on reconnect |
| Product catalog (products + stock_qty + purchase_price) | `product.py` | No purchase transaction type yet |
| Redis cache (catalog 10min, route 5min, insights 2min) | `CacheBackend` | Invalidated on write |
| React Query client cache | Frontend | Not persisted to IndexedDB yet |
| `@react-pdf/renderer` — not yet installed | — | Needs adding |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that make the v1.2 scope feel complete. Missing any of these = the milestone is not done.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Expense logging — Sales rep field expenses** | Reps spend money on fuel, parking, meals during route. Business needs records for reimbursement and tax. Without this, expenses are tracked on paper or not at all. | MEDIUM | New `Expense` model (not a Transaction — different semantic). Fields: amount, currency, category (enum: fuel / meals / parking / misc), date, notes, receipt_url, created_by (user), status (Pending / Confirmed / Flagged). Separate table; no customer_id (business-level). Soft delete via BaseMixin. |
| **Expense logging — Admin business expenses** | Admin needs to record non-salesman costs (rent, supplies, bank fees). Same model as field expenses but category scope differs. | LOW | Same `Expense` model with role-based categories. Admin can create with any category. Salesman restricted to field categories only. No workflow difference — just category enum extended. |
| **Daily cash report with date traversal** | Admin needs a consolidated view: "What did each salesman collect today, and has it been handed over?" Replaces the EOD Slack summary with an interactive UI. | MEDIUM | New Admin page. Date picker (default today). Per-rep breakdown: orders placed, cash collected, check count, total. Date traversal: prev/next day arrows. Reads from existing transaction data — no new backend model. New endpoint: `GET /admin/daily-report?date=YYYY-MM-DD`. |
| **Payment confirmation / flagging** | Admin must be able to mark each salesman's daily cash handover as confirmed or flag a discrepancy. "Ahmed collected 2,400 ILS — confirmed received" or "Flagged: reported 2,400, received 2,200." | MEDIUM | New `CashHandover` model: date, user_id (rep), reported_amount, confirmed_amount (nullable), status (Pending / Confirmed / Flagged), admin_notes, confirmed_by (admin user_id), confirmed_at. Links to a date + rep, not individual transactions. One row per rep per day. |
| **Offline catalog caching** | Sales reps browse catalog offline when visiting customers with no connectivity. Currently catalog is fetched fresh on load — if offline, nothing displays. | MEDIUM | Persist React Query catalog cache to IndexedDB using `@tanstack/react-query-persist-client` + `idb-keyval`. Catalog TTL in IndexedDB: 24h (longer than Redis 10min, because offline needs day-long coverage). Service worker optional — React Query persister is sufficient. Mark stale data with "last updated" badge. |
| **Offline route data caching** | Reps need customer list + today's orders available when offline. Already have sync queue for new mutations; read-side (customer data, route) must also survive offline. | MEDIUM | Same persistence approach as catalog. Persist `my-route` and `by-day/{day}` query results to IndexedDB. TTL: 12h. On app load: serve from IndexedDB, background-refresh when online. Existing mutation sync queue (orders/payments) already handles the write side — no change needed there. |
| **Purchase from customer (reverse order)** | Business buys goods back from customers (returns, buy-back of surplus stock). Increases inventory, reduces customer debt. Existing `Order` type only goes one direction (sale). | HIGH | New `TransactionType.Purchase` enum value. New endpoint `POST /purchases`. Service: creates positive amount transaction (like Order — increases customer balance) but also increments `product.stock_qty` and recalculates `product.purchase_price` using weighted-average cost formula. Frontend: new PurchaseFlow component in Sales, similar to order flow but labeled differently. |
| **Weighted-average cost recalculation on purchase** | When buying back goods, the purchase price per unit changes based on blended history. Standard accounting (WAC = (existing stock cost + new purchase cost) / total units). Keeps `product.purchase_price` accurate. | MEDIUM | Formula: `new_wac = (old_stock_qty * old_purchase_price + qty_bought * buy_price) / (old_stock_qty + qty_bought)`. Applied in purchase service atomically with stock_qty update. Alembic migration not needed — `purchase_price` column already exists. |
| **Custom date range picker in customer statements** | Existing statement API already accepts `start_date`/`end_date`. The frontend only offers presets (7d, 30d, 90d, since-zero). Users need arbitrary ranges for period-end reporting. | LOW | Replace or augment the preset buttons with a date range input (two date pickers: from / to). The `getStatement` API call already supports this — purely frontend work. Uses existing `DatePicker` UI component. |
| **Customer statement PDF export** | Accountants and customers need printable statements. Digital scrolling is not sufficient for record-keeping or handing to a customer. | MEDIUM | Use `@react-pdf/renderer` (not jsPDF — see Anti-Features). Generate PDF client-side from statement data already in React Query cache. PDF structure: header (business name, customer name, date range), transaction table (date, type, amount, balance), closing balance. RTL text: `@react-pdf/renderer` supports RTL via `textDirection: 'rtl'` on `<Text>`. Download triggered by button in statement view. No backend change. |

### Differentiators (Competitive Advantage)

Features that raise the quality bar above a basic business app.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Expense receipt photo capture** | Field reps photograph paper receipts on the spot. No lost receipts, no reimbursement disputes. Same upload pattern as check photos (already proven). | LOW | Reuse `/static/receipts/` + `aiofiles` pattern from check image upload. Frontend: `<input type="file" accept="image/*" capture="environment">` in expense form. Store `receipt_url` in `Expense.receipt_url` column. |
| **Cash report discrepancy highlighting** | When admin confirmed amount differs from reported amount by >5%, visually flag the rep row in red. Instant audit signal without manual calculation. | LOW | Pure frontend logic. Compute `abs(confirmed - reported) / reported` — if >5%, apply red styling. No backend change. |
| **Offline-aware data freshness indicators** | "Catalog last updated 3h ago" badge when offline. Users know whether to trust the data they see. Reduces confusion when serving stale cache. | LOW | Read persisted-at timestamp from IndexedDB. Compare to now. Display badge in CatalogView header. Localizable string. |
| **Purchase from customer in customer statement** | Purchase transactions appear in the customer statement with a distinct type label ("Purchase / شراء"), so the customer can see their full transaction history including goods sold back. | LOW | No schema change — uses existing statement query which shows all transaction types. Just needs correct label in statement UI for the new `Purchase` type. |
| **DB performance indexes** | Queries on transactions table degrade as data grows. `created_by`, `type`, `status` columns filter in every admin/statement query but have no indexes. | LOW | Alembic migration adding: `idx_transactions_created_by`, `idx_transactions_type`, `idx_transactions_status`. Compound index on `(created_by, type, created_at)` for the daily report query pattern. No code change beyond migration. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Expense approval multi-level workflow** | "Manager reviews, then finance approves" | Overkill for a 2-3 person office. Every extra step is a friction point that causes reps to stop submitting expenses. | Simple confirm/flag by Admin. One human decision, one status field. |
| **jsPDF for statement export** | Popular, lots of tutorials | jsPDF requires manual coordinate-based layout. RTL Arabic text requires extra hacks. Breaks on multi-page content. Hard to maintain. | `@react-pdf/renderer` uses React component model, supports RTL via `textDirection`, handles pagination natively. More maintainable. |
| **Server-side PDF generation** | "Backend controls the template" | Breaks offline-first. Adds server load. Requires puppeteer/wkhtmltopdf server dependency. Client already has all the data. | Client-side `@react-pdf/renderer`. Data is in React Query cache. Download happens instantly. |
| **Automatic WAC update on every product edit** | "Keep purchase_price always current" | Admin manually editing purchase_price via Designer UI should not trigger WAC recalculation — that would corrupt carefully set values. | WAC recalculation only triggered by `Purchase` transaction service. Manual edit via Designer remains a direct override. |
| **Real-time cash report sync** | "Admin sees rep's new payments instantly as they happen" | Adds WebSocket or polling complexity. For an EOD reconciliation workflow, near-real-time (page refresh) is sufficient. | Manual refresh button on cash report. Or implicit refresh on navigation. Statement is accurate to last page load. |
| **Offline expense submission** | "Reps should be able to submit expenses offline too" | Expense submission is lower urgency than orders/payments (no customer-facing impact). Adds complexity to already-extended sync queue. | Expenses require connectivity. Inform rep with disabled state + offline banner. Orders/payments retain offline priority. |
| **Purchase order / supplier management** | "Track where we buy our stock" | Entirely different domain — supplier relationships, POs, receiving workflow. Out of scope for this business model (customer buy-back, not supplier procurement). | Purchase from customer (buy-back) only. Supplier procurement is a separate system concern. |

---

## Feature Dependencies

```
[DB Indexes]
    (no dependencies — purely additive migration)

[Expense Model — backend]
    └──enables──> [Expense logging — Sales rep]
    └──enables──> [Expense logging — Admin]
    └──enables──> [Expense receipt photo]     (needs expense record to attach to)
    └──enables──> [Admin expense review]      (needs expense records to confirm/flag)

[CashHandover Model — backend]
    └──requires──> [Daily cash report endpoint]  (report is read-only; handover is write)
    └──enables──> [Payment confirmation UI]

[Daily cash report endpoint]
    └──requires──> [DB Indexes]               (daily report query hits created_by + type + date)
    └──enables──> [Daily cash report UI]
    └──enables──> [Cash discrepancy highlighting]

[Offline catalog caching — IndexedDB persister]
    └──enables──> [Offline data freshness indicators]
    └──enables──> [Offline route data caching]  (same persister setup, different queries)

[Purchase TransactionType — backend]
    └──requires──> [DB Indexes]               (purchase queries filter by type)
    └──enables──> [WAC recalculation]         (triggered by purchase service)
    └──enables──> [Purchase from customer UI] (PurchaseFlow component)
    └──enables──> [Purchase in customer statement]  (statement shows all types; label only)

[Custom date range picker]
    (no new dependencies — API already supports start_date/end_date)
    └──enables──> [Statement PDF export]      (PDF covers the selected date range)

[Statement PDF export]
    └──requires──> [Custom date range picker]  (natural entry point for PDF trigger)
    └──requires──> @react-pdf/renderer installed
```

### Dependency Notes

- **DB indexes first:** The daily cash report query joins transactions on `created_by`, `type`, and date. Adding indexes before building the report endpoint prevents slow queries from the start.
- **Expense model is independent:** Can be built in parallel with offline caching and purchase features. No cross-dependency.
- **CashHandover is additive:** The daily report reads existing transaction data. `CashHandover` only tracks the admin confirmation layer on top — the report works without it (read-only mode), confirmation is the second step.
- **Offline caching is read-side only:** The mutation sync queue for orders/payments already exists. This feature only adds read-side persistence. No conflict with existing sync logic.
- **Purchase service is self-contained:** WAC calculation happens inside the purchase service atomically. No other service touches `purchase_price` programmatically — Designer edit is a direct field write, not WAC-triggered.
- **PDF depends on custom date range:** The PDF should export exactly the range the user is viewing. Building custom date range first means the PDF trigger is a natural addition to the same UI.

---

## MVP Definition

This is a subsequent milestone on a shipped product. "MVP" here means: minimum to deliver the stated v1.2 goal — not minimum to launch a product.

### Launch With (v1.2)

- [ ] **DB performance indexes** — prerequisite for everything query-heavy; Alembic migration only
- [ ] **Expense logging backend** (Expense model + CRUD endpoints) — foundational for expense features
- [ ] **Expense logging frontend** — Sales rep submits field expenses; Admin submits business expenses
- [ ] **Daily cash report + payment confirmation** — Admin's primary operational need for this milestone
- [ ] **Offline catalog caching** — Sales rep critical path; catalog must survive no connectivity
- [ ] **Offline route data caching** — Sales rep critical path; customer list must survive no connectivity
- [ ] **Purchase from customer** (backend + frontend) — reverse order with WAC update
- [ ] **Custom date range picker in statement** — purely frontend; API already supports it
- [ ] **Customer statement PDF export** — closes the statement feature loop

### Add After Validation (v1.x)

- [ ] **Expense receipt photo capture** — adds legal record keeping; can ship after core expense flow is stable
- [ ] **Cash report discrepancy highlighting** — frontend-only polish; add when cash report is in use
- [ ] **Offline data freshness indicators** — UX quality; implement after offline caching is working

### Future Consideration (v2+)

- [ ] **Offline expense submission** — adds queue complexity; defer until explicitly requested
- [ ] **Supplier / purchase order management** — different domain; not part of this app's scope
- [ ] **Check batch reconciliation view** — explicitly deferred per PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| DB indexes | HIGH (prevents future pain) | LOW | P1 |
| Expense logging backend | HIGH | MEDIUM | P1 |
| Expense logging frontend (Sales) | HIGH | MEDIUM | P1 |
| Expense logging frontend (Admin) | HIGH | LOW (same UI, different categories) | P1 |
| Daily cash report (read) | HIGH | MEDIUM | P1 |
| Payment confirmation (write) | HIGH | MEDIUM | P1 |
| Offline catalog caching | HIGH | MEDIUM | P1 |
| Offline route data caching | HIGH | LOW (same pattern as catalog) | P1 |
| Purchase from customer | HIGH | HIGH | P1 |
| WAC recalculation | HIGH | MEDIUM | P1 |
| Custom date range picker | MEDIUM | LOW | P1 |
| Statement PDF export | MEDIUM | MEDIUM | P1 |
| Expense receipt photo | MEDIUM | LOW | P2 |
| Cash discrepancy highlighting | LOW | LOW | P2 |
| Offline freshness indicators | LOW | LOW | P2 |

**Priority key:**
- P1: Required for v1.2 milestone to be complete
- P2: Quality improvement, add once P1 is stable
- P3: Future milestone

---

## New Models Required

| Model | Purpose | Key Fields | Depends On |
|-------|---------|------------|------------|
| `Expense` | Track all business expenses (field + admin) | amount, currency, category (enum), date, notes, receipt_url, created_by, status (Pending/Confirmed/Flagged), confirmed_by, confirmed_at | BaseMixin (UUID, soft delete) |
| `CashHandover` | Admin confirmation of daily cash from each rep | date, user_id, reported_amount, confirmed_amount, status (Pending/Confirmed/Flagged), admin_notes, confirmed_by, confirmed_at | User model |
| `TransactionType.Purchase` (enum addition) | Reverse order (buy-back from customer) | Extends existing enum; same `Transaction` table via STI | Transaction model + migration |

### New Endpoints Required

| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `POST /expenses` | POST | Sales/Admin | Create expense |
| `GET /expenses` | GET | Admin | List all expenses (filterable by rep, date, status) |
| `GET /expenses/mine` | GET | Sales | List own expenses |
| `PATCH /expenses/{id}/confirm` | PATCH | Admin | Confirm expense |
| `PATCH /expenses/{id}/flag` | PATCH | Admin | Flag expense discrepancy |
| `GET /admin/daily-report` | GET | Admin | Per-rep daily summary by date |
| `POST /admin/cash-handover` | POST | Admin | Record cash handover confirmation |
| `PUT /admin/cash-handover/{id}` | PUT | Admin | Update confirmation |
| `POST /purchases` | POST | Sales/Admin | Record purchase from customer |
| `GET /admin/daily-report/export` | GET | Admin | (future) CSV export — defer |

---

## Integration Points with Existing Code

| New Feature | Touches Existing | Change Type |
|-------------|-----------------|-------------|
| DB indexes | `alembic/versions/` | New migration only |
| Expense model | New `expense.py` model file | Additive |
| Expense endpoints | New `expenses.py` router | Additive |
| Daily cash report | `admin_service.py` | New method; extends existing pattern |
| CashHandover model | New `cash_handover.py` | Additive |
| Offline catalog cache | `frontend/src/main.tsx` or `App.tsx` | Add `PersistQueryClientProvider` wrapper |
| Offline route cache | `salesApi.ts` query keys | Add `staleTime` + persister config |
| Purchase transaction | `transaction.py` enum, new `purchase_service.py` | Extend enum + new service |
| Purchase WAC | `product.py` — no schema change | `purchase_service.py` updates `stock_qty` + `purchase_price` |
| PurchaseFlow UI | New `Sales/PurchaseFlow.tsx` | New component; mirrors OrderFlow |
| Custom date range | `Sales/StatementView.tsx` | Replace preset buttons with date inputs |
| PDF export | `Sales/StatementView.tsx` | Add download button + `@react-pdf/renderer` Document component |

---

## Sources

- Code audit: `/home/ka1ser/projects/alofok/backend/app/models/transaction.py` — existing TransactionType enum
- Code audit: `/home/ka1ser/projects/alofok/backend/app/models/product.py` — `stock_qty`, `purchase_price` columns confirmed
- Code audit: `/home/ka1ser/projects/alofok/backend/app/services/admin_service.py` — existing query patterns
- Code audit: `/home/ka1ser/projects/alofok/frontend/src/services/salesApi.ts` — `getStatement` already accepts `start_date`/`end_date`
- [Expense Management for Field Sales — BreezeFSM](https://breezefsm.in/expense-management-for-field-sales/) — field expense category patterns
- [Weighted Average Cost — ShipBob](https://www.shipbob.com/blog/inventory-weighted-average/) — WAC formula verification
- [Weighted Average Cost — Corporate Finance Institute](https://corporatefinanceinstitute.com/resources/accounting/weighted-average-cost-method/) — GAAP/IFRS confirmation
- [Generating PDFs in React with react-pdf — LogRocket](https://blog.logrocket.com/generating-pdfs-react/) — library comparison
- [Best JavaScript PDF libraries 2025 — Nutrient](https://www.nutrient.io/blog/javascript-pdf-libraries/) — @react-pdf/renderer vs jsPDF tradeoffs
- [Offline-first frontend apps in 2025 — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — IndexedDB patterns
- [Powering offline-ready apps with React Query](https://www.kylereblora.com/posts/powering-offline-ready-apps-with-react-query) — persist client setup
- [Cash Reconciliation Guide — Numeric](https://www.numeric.io/blog/cash-reconciliation-guide) — daily reconciliation workflow patterns

---

*Feature research for: Alofok v1.2 Business Operations milestone*
*Researched: 2026-03-05*
