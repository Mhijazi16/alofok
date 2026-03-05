# Project Research Summary

**Project:** Alofok v1.2 — Business Operations
**Domain:** Wholesale trading app — expense tracking, cash reconciliation, offline caching, purchase from customer, PDF export
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

Alofok v1.2 is a business-operations milestone layered on top of a fully-shipped v1.0/v1.1 wholesale trading application. The stack is fixed and proven — React + FastAPI + PostgreSQL + Redis, with IndexedDB for offline mutation queuing. This milestone adds six functional areas: expense tracking, daily cash reconciliation, offline catalog and route caching, purchase-from-customer with weighted-average costing, custom date range picker for statements, and PDF statement export. None of these require new third-party infrastructure decisions beyond five frontend dependencies (`react-day-picker` v9 upgrade, `@react-pdf/renderer`, `idb-keyval`, `@tanstack/react-query-persist-client`, `vite-plugin-pwa`) and zero new Python packages for backend logic.

The recommended approach is to treat the database as the single source of truth and do all work in strict dependency order. Four Alembic migrations must land first: performance indexes on the transactions table, the `Purchase` enum value, the `expenses` table, and the `daily_cash_reports` table. These unblock all six feature tracks. The architecture is well-defined: a separate `Expense` model (not mixed into `Transaction`), an atomic purchase service with `SELECT FOR UPDATE`, a JSONB-snapshot `DailyCashReport` model, client-side PDF generation via `@react-pdf/renderer` with an `asyncio.to_thread` + `weasyprint` server-side fallback documented in the Dockerfile, and a React Query persister backed by `idb-keyval` for the read-side offline cache.

The principal risk areas are data integrity (expenses polluting customer statements if added to the wrong table, WAC calculation on nullable product fields, double-confirmation corrupting balances) and offline correctness (stale catalog prices after purchase stock updates, sync queue halting on permanent 4xx errors). All of these have clear prevention strategies documented in PITFALLS.md and map to specific phases where the guard must be implemented before the feature proceeds.

---

## Key Findings

### Recommended Stack

The existing stack handles all v1.2 features with only five frontend additions. The most significant decision is **client-side PDF generation** via `@react-pdf/renderer` — this avoids adding GTK/Pango/Cairo system libraries to the `python:3.12-slim` Docker image and keeps PDF generation offline-capable. ARCHITECTURE.md also documents a server-side `weasyprint` pattern (Pattern 5); STACK.md explicitly rejects weasyprint as the primary path but acknowledges it as a named fallback if Arabic glyph rendering proves unworkable in the browser. Client-side wins.

**Core technologies (new additions only):**
- `react-day-picker@^9.14.0` (upgrade from v8): date range picker for statements — v9 adds first-class `mode="range"` and correct RTL calendar support; date-fns is now bundled, removing peer dependency friction
- `@react-pdf/renderer@^4.3.2`: client-side Arabic PDF generation — requires Cairo TTF fonts placed in `public/fonts/`; has a documented glyph edge case (#2638) that warrants early testing with real statement content
- `idb-keyval@^6.2.2`: 0.6KB IndexedDB key-value wrapper — replaces direct IndexedDB calls for the new read-side catalog/route cache; recommended by TanStack Query v5 official docs
- `@tanstack/react-query-persist-client@^5.90.24`: official React Query v5 persistence plugin — pairs with `idb-keyval`; must share the same major version as `@tanstack/react-query` (both v5)
- `vite-plugin-pwa@^1.2.0`: Workbox service worker for pre-caching app shell and product images offline — v1.x series required for Vite 6 compatibility (the v0.21.0 compatibility break was fixed in v1.x)

**Backend: zero new Python packages.** Purchase WAC, expense CRUD, and cash report aggregation are pure SQLAlchemy. PDF is client-side. If weasyprint fallback is ever needed, system deps are documented but not added yet.

### Expected Features

**Must have (table stakes for v1.2 milestone):**
- DB performance indexes on `transactions(created_by, type, status)` — prerequisite for all reporting queries; pre-existing known performance gap
- Expense logging (field expenses for Sales reps, business expenses for Admin) — separate `expenses` table; not mixed into `transactions`
- Daily cash report with date navigation — per-rep payment summary aggregated from existing Transaction data
- Payment confirmation / flagging on `DailyCashReport` model — idempotent state-transition only; JSONB snapshot for audit stability
- Offline catalog caching — React Query persister + IndexedDB `catalog_cache` store; DB bumps to version 3
- Offline route data caching — same pattern as catalog; `route_cache` store added alongside `catalog_cache`
- Purchase from customer — `TransactionType.Purchase`, `PurchaseService` with atomic WAC update + `SELECT FOR UPDATE`
- Weighted-average cost recalculation — server-side only; frontend shows estimated preview clearly labelled
- Custom date range picker in statements — pure frontend; API already accepts `start_date`/`end_date`
- Customer statement PDF export — client-side `@react-pdf/renderer` with Arabic Cairo font registered via `Font.register()`

**Should have (quality improvements, add after core P1 stable):**
- Expense receipt photo capture — reuses existing check-image upload pipeline; `receipt_url` column already modeled
- Cash report discrepancy highlighting — frontend-only; >5% delta between reported and confirmed triggers red row styling
- Offline data freshness indicators — "Catalog last updated X ago" badge sourced from IndexedDB `cached_at` timestamp

**Defer to v2+:**
- Offline expense submission (adds sync queue complexity; expense submission is not customer-facing critical path)
- Supplier/purchase order management (different domain scope, not customer buy-back)
- Check batch reconciliation view (explicitly deferred in PROJECT.md)

### Architecture Approach

The architecture extends the existing layered pattern (endpoints → services → repositories → models) with four new files in each layer and four Alembic migrations. `Expense` and `DailyCashReport` are new tables, not extensions of `Transaction`. `TransactionType.Purchase` extends the existing enum via `ALTER TYPE ... ADD VALUE`. The frontend adds `lib/offlineCache.ts` (IndexedDB v3 with `catalog_cache` + `route_cache` stores, shared `openDB()` with `syncQueue.ts`) and extends `salesApi.ts`, `adminApi.ts`, and `StatementView.tsx`.

**Major components:**
1. `PurchaseService` — wraps product stock updates, WAC recalculation, and Transaction creation in a single `async with session.begin()` with `SELECT FOR UPDATE` on each product row; calls `cache.invalidate_prefix("catalog:")` after commit to prevent Redis staleness
2. `AdminService` (extended) — `get_or_generate_report()` implements JSONB-snapshot upsert pattern; confirmed reports are immutable (guarded by status check before any re-aggregation)
3. `offlineCache.ts` — centralized IndexedDB v3 module shared by `syncQueue.ts`; exposes `saveCatalog`, `loadCatalog`, `saveRoute`, `loadRoute` with `cached_at` timestamps for freshness tracking
4. `StatementView.tsx` (extended) — adds `"custom"` preset, date range UI, PDF download button; enforces mutual exclusivity of `since_zero` and custom date range at the UI layer before the backend can receive conflicting params

### Critical Pitfalls

1. **Expenses in the transactions table** — adding `Expense_Field`/`Expense_Business` to `TransactionType` means every existing customer statement query silently includes expense rows unless guards are added everywhere. Prevention: separate `expenses` table; verify with integration test that `GET /customers/{id}/statement` returns zero expense rows after adding 5 expenses.

2. **WAC calculation on nullable fields** — `product.stock_qty` and `product.purchase_price` are both nullable in the current schema. `None * qty` raises `TypeError` on the first purchase ever. Prevention: `old_qty = product.stock_qty or 0` / `old_price = product.purchase_price or Decimal("0")` before any arithmetic; write explicit null-base-case unit tests.

3. **Cash report multi-currency accuracy** — `Transaction.amount` is always ILS-equivalent regardless of the `currency` field. Summing `amount GROUP BY currency` shows ILS values labelled as USD/JOD. Prevention: derive `original_amount = ABS(amount) / exchange_rate` from `data->>'exchange_rate'`; show both original and ILS subtotals per currency group.

4. **Confirmation double-apply** — double-click or network retry on the confirm endpoint must not re-apply side effects. Prevention: idempotency guard in the service (`if report.status != "pending": raise HorizonException(409)`); disable confirm button immediately on first click; do not use optimistic updates for financial confirmation.

5. **Redis cache stale after purchase stock update** — `PurchaseService` directly modifies `product.stock_qty`/`purchase_price`, bypassing `CatalogService`'s cache invalidation path. Prevention: call `cache.invalidate_prefix("catalog:")` inside the purchase service after the DB commit; add integration test that `GET /catalog` after a purchase reflects updated `stock_qty`.

6. **Sync queue halting on permanent 4xx failures** — the current `useOfflineSync.ts` uses `break` on first error. A queued order targeting a soft-deleted customer returns 403 and stops all subsequent items from flushing. Prevention: distinguish 4xx (skip + move to failed-items store, continue flush) from 5xx/network errors (stop + retry).

---

## Implications for Roadmap

Based on research, suggested phase structure (6 phases):

### Phase 1: DB Foundation and Indexes
**Rationale:** All six feature tracks depend on at least one of the four migrations. The transaction index migration also addresses a pre-existing performance regression on cash report and statement queries. Nothing else can safely start until migrations land and are verified. Two developers can branch immediately after Phase 1 for parallel tracks.
**Delivers:** Four Alembic migrations (performance indexes on transactions, `Purchase` enum value, `expenses` table, `daily_cash_reports` table); all subsequent tracks unblocked
**Addresses:** DB performance indexes (FEATURES.md P1 prerequisite)
**Avoids:** Pitfall 1 (expense table isolation locked in before any endpoint is built), Pitfall 8 (Purchase enum migration done before service or UI)

### Phase 2: Daily Cash Report and Payment Confirmation
**Rationale:** This is the Admin's primary operational need for the milestone. Its data dependencies (existing Transaction data + new `daily_cash_reports` table from Phase 1) are immediately available. The currency bug in the existing EOD report must be fixed here before it propagates to the new report.
**Delivers:** `DailyCashReport` model + `AdminService` extension; `GET /admin/reports/daily-cash` + confirm/flag endpoints; `Admin/DailyCashReport.tsx` with date navigator and per-rep summary cards
**Uses:** ARCHITECTURE.md Pattern 2 (JSONB snapshot for audit records); idempotency guard for confirmation state
**Avoids:** Pitfall 3 (multi-currency cash report accuracy), Pitfall 4 (double-confirmation corrupting balances)

### Phase 3: Expense Tracking
**Rationale:** Expense model and endpoints are independent of both cash report and purchase features. Building it after Phase 2 allows the `DailyCashReport` summary endpoint to include expense totals in its per-rep aggregation. Receipt photo upload reuses the existing `aiofiles` + `/static` pipeline with zero new infrastructure.
**Delivers:** `Expense` model + `ExpenseService` + `ExpenseRepository`; expense CRUD endpoints for Sales and Admin; `Sales/ExpenseForm.tsx` + `Sales/ExpensesView.tsx`; receipt photo upload via existing pipeline
**Uses:** Existing `python-multipart` + `aiofiles` + `/static` pattern (same as check image upload in v1.1)
**Avoids:** Pitfall 1 (expenses isolated from transactions table; verified by integration test that statement query returns zero expense rows)

### Phase 4: Offline Catalog and Route Caching
**Rationale:** The read-side offline cache is independent of all other tracks and is a Sales rep critical-path requirement. Building it before Purchase (Phase 5) means `PurchaseFlow` will have access to the offline catalog for product selection. The sync queue error-handling fix (4xx vs 5xx distinction) belongs here to prevent the queue from stalling before the "purchase" item type is added in Phase 5.
**Delivers:** `offlineCache.ts` (IndexedDB v3, `catalog_cache` + `route_cache` stores, shared `openDB()` with `syncQueue.ts`); `vite-plugin-pwa` service worker; React Query persister integration; sync queue permanent-failure handling fix; offline freshness indicators
**Uses:** `idb-keyval`, `@tanstack/react-query-persist-client`, `vite-plugin-pwa` (STACK.md new additions)
**Avoids:** Pitfall 5 (stale offline catalog prices; catalog invalidation on successful API fetch), Pitfall 6 (sync queue halting on 403 for deleted/reassigned customers)

### Phase 5: Purchase from Customer and WAC
**Rationale:** The highest implementation complexity in the milestone (atomic WAC update, enum extension, Redis cache invalidation chain, offline queue extension). Building after Phase 4 means `PurchaseFlow` can use the IndexedDB catalog for product selection, and the sync queue infrastructure already handles permanent failure gracefully. Cache invalidation coordination with `CatalogService` is the key design constraint.
**Delivers:** `PurchaseService` with WAC + `SELECT FOR UPDATE`; `POST /purchases` endpoint; `Sales/PurchaseFlow.tsx`; sync queue extended with "purchase" type in `syncQueue.ts` + `useOfflineSync.ts`; `TransactionType.Purchase` locale keys in `ar.json` + `en.json`
**Uses:** ARCHITECTURE.md Pattern 1 (atomic WAC with row lock); Pattern 4 (offline queue type extension)
**Avoids:** Pitfall 2 (nullable WAC fields; null-base-case tests required), Pitfall 8 (purchase labeled distinctly from cash payment in statement), Pitfall 9 (Redis invalidation after stock update via `cache.invalidate_prefix`)

### Phase 6: Statement Enhancements and PDF Export
**Rationale:** Custom date range and PDF export are pure statement-layer features with no backend model dependencies (the statement API already supports `start_date`/`end_date`). PDF export naturally comes last because it benefits from having Purchase transactions correctly labeled (Phase 5 output) and the `since_zero` mutual exclusivity rule must be established before wiring the PDF trigger.
**Delivers:** `react-day-picker` v9 upgrade + custom date range UI in `StatementView.tsx`; PDF download button; `@react-pdf/renderer` document component with Cairo Arabic font registered; `public/fonts/` Cairo TTF files; `window.print()` fallback option if glyph errors surface
**Uses:** `@react-pdf/renderer` (STACK.md); `react-day-picker@^9.14.0` (upgrade); ARCHITECTURE.md Pattern 3 (IndexedDB version bump) for service worker integration
**Avoids:** Pitfall 7 (client-side PDF eliminates event loop blocking entirely), Pitfall 10 (`since_zero` + custom range mutual exclusivity enforced at UI layer before PDF is wired)

### Phase Ordering Rationale

- **Phase 1 must be first** — all other phases depend on at least one of the four migrations; running without the DB foundation risks FK violations, Alembic state conflicts, and slow reporting queries
- **Phases 2, 3, and 4 are parallelizable** after Phase 1 — cash report, expense tracking, and offline caching have no cross-dependencies; two developers can run them in parallel
- **Phase 5 benefits from Phase 4** — PurchaseFlow uses the offline catalog; the sync queue 4xx/5xx fix in Phase 4 should precede adding the "purchase" queue item type in Phase 5
- **Phase 6 last** — PDF benefits from Purchase transactions being correctly labeled (Phase 5 output); custom date range and PDF share the same StatementView component and the range state drives PDF parameters; `since_zero` precedence rule must be locked before PDF is wired

### Research Flags

Phases likely needing review during implementation planning:

- **Phase 4 (Offline caching):** The `vite-plugin-pwa` + `@tanstack/react-query-persist-client` dual-layer architecture has interaction edge cases (which layer owns which data, hydration order on cold start, IndexedDB v3 upgrade blocking in active sessions). A plan review before coding is recommended.
- **Phase 5 (Purchase + WAC):** The `SELECT FOR UPDATE` async SQLAlchemy pattern and the cache invalidation chain through `CatalogService` need a written plan step before implementation. Concurrent purchase flushes from multiple reps hitting the same product must be documented as an explicit assumption (serialized by row lock, accepted at this scale).
- **Phase 6 (PDF):** Arabic glyph rendering in `@react-pdf/renderer` has a documented issue (#2638). Test with real Arabic statement content (Arabic customer name, mixed Arabic/numeric amounts) early in the phase. If rendering fails, implement `window.print()` as a parallel fallback before marking the phase done.

Phases with standard patterns (no additional research needed):
- **Phase 1:** Alembic migration authoring is a fully established pattern in this codebase.
- **Phase 2:** JSONB snapshot + confirm/flag state machine is a standard FastAPI pattern with no external API surface.
- **Phase 3:** Expense CRUD follows the exact same model/service/repository/endpoint pattern already established in v1.0.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified via bun info + npm registry; WeasyPrint rejection confirmed via Docker image size analysis; one MEDIUM gap: `@react-pdf/renderer` Arabic glyph reliability under real statement content (documented issue #2638, mitigable with font setup and split text nodes) |
| Features | HIGH | Based on direct code audit of existing endpoints, models, and frontend; WAC formula verified against GAAP/IFRS references; feature boundaries are clear with explicit dependency graph |
| Architecture | HIGH | Existing codebase inspected directly; all patterns extend established project conventions; `SELECT FOR UPDATE` + async SQLAlchemy is well-documented; one minor conflict: ARCHITECTURE.md Pattern 5 (weasyprint) contradicts STACK.md recommendation — client-side PDF wins |
| Pitfalls | HIGH | Pitfalls derived from direct inspection of existing code (the EOD report currency bug exists today; the sync queue `break` on error exists today); all 10 pitfalls have verified prevention strategies and phase-to-prevention mapping |

**Overall confidence:** HIGH

### Gaps to Address

- **`@react-pdf/renderer` Arabic rendering in practice:** Test with real customer statement data (Arabic names, mixed Arabic/numeric amounts in table cells) early in Phase 6 before building the full PDF component. If glyph errors appear, implement `window.print()` as a zero-dependency parallel option using `@media print` CSS.
- **Capacitor mobile conflict:** `vite-plugin-pwa` service workers conflict with Capacitor's WKWebView on iOS. This milestone targets web only, but if Capacitor deployment is planned for v1.3+, the Phase 4 PWA architecture must be reconsidered. Document this as a known constraint at the end of Phase 4.
- **`weasyprint` in ARCHITECTURE.md vs STACK.md conflict:** ARCHITECTURE.md Pattern 5 provides a full server-side weasyprint PDF implementation. STACK.md explicitly rejects it as the primary approach. The roadmap should treat client-side `@react-pdf/renderer` as the default; weasyprint is a named fallback option that requires Dockerfile changes if ever activated.
- **`DailyCashReport` scope vs per-transaction confirmation:** PITFALLS.md mentions storing `confirmed_at` on Transaction records; ARCHITECTURE.md uses a separate `DailyCashReport` model that aggregates a day's transactions. These are complementary, not contradictory — `DailyCashReport` is the per-day admin confirmation artifact; per-transaction confirmed state is not in scope for v1.2. Clarify this in Phase 2 planning to prevent scope creep.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `backend/app/models/transaction.py`, `product.py`, `services/admin_service.py`, `payment_service.py`, `frontend/src/lib/syncQueue.ts`, `hooks/useOfflineSync.ts`, `components/Sales/StatementView.tsx`
- npm registry / bun info verified: `react-day-picker@9.14.0`, `@react-pdf/renderer@4.3.2`, `idb-keyval@6.2.2`, `@tanstack/react-query-persist-client@5.90.24`, `vite-plugin-pwa@1.2.0`
- [react-day-picker Range Mode docs](https://daypicker.dev/selections/range-mode) — `mode="range"` API verified
- [TanStack Query v5 createPersister docs](https://tanstack.com/query/latest/docs/framework/react/plugins/createPersister) — IndexedDB persister pattern verified
- [MDN / web.dev IndexedDB Best Practices](https://web.dev/articles/indexeddb-best-practices) — version upgrade behavior

### Secondary (MEDIUM confidence)
- [@react-pdf/renderer Arabic issue #2638](https://github.com/diegomura/react-pdf/issues/2638) — bidi glyph errors after RTL support added
- [vite-plugin-pwa GitHub issue #800](https://github.com/vite-pwa/vite-plugin-pwa/issues/800) — Vite 6 compatibility break in 0.21.0, fixed in v1.x
- [WeasyPrint Docker installation](https://github.com/Kozea/WeasyPrint/issues/699) — system dependency weight confirmed
- [jsPDF-AutoTable Arabic issues #614, #824, #940](https://github.com/simonbengtsson/jsPDF-AutoTable/issues) — unresolved Arabic rendering bugs confirmed
- [Cash Reconciliation Guide — Numeric](https://www.numeric.io/blog/cash-reconciliation-guide) — daily reconciliation workflow patterns
- [Weighted Average Cost — Corporate Finance Institute](https://corporatefinanceinstitute.com/resources/accounting/weighted-average-cost-method/) — WAC formula verification

### Tertiary (referenced for completeness)
- [Offline-first frontend apps 2025 — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Generating PDFs in React — LogRocket](https://blog.logrocket.com/generating-pdfs-react/)
- [Expense Management for Field Sales — BreezeFSM](https://breezefsm.in/expense-management-for-field-sales/)
- [Weighted Average Cost — ShipBob](https://www.shipbob.com/blog/inventory-weighted-average/)

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
