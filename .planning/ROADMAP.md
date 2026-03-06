# Roadmap: Alofok

## Milestones

- [x] **v1.0 Core Trading Platform** - Phases 1-5 (shipped 2026-03-04)
- [x] **v1.1 Check Enhancement** - Phases 6-9 (shipped 2026-03-04)
- [ ] **v1.2 Business Operations** - Phases 10-15 (in progress)

## Phases

<details>
<summary>v1.0 Core Trading Platform (Phases 1-5) - SHIPPED 2026-03-04</summary>

Phases 1-5 were pre-GSD tracked via Feature.json. Shipped all 22 original PRD features plus: design system rebuild, customer portal, delivery date routing, bonus orders, multi-select order cards, admin reassignment, order delete/undeliver.

</details>

<details>
<summary>v1.1 Check Enhancement (Phases 6-9) - SHIPPED 2026-03-04</summary>

Enhanced check data capture (CheckData model, bank/branch/account fields), live SVG check preview, check lifecycle management (Pending → Deposited → Returned), and camera/OCR image capture.

</details>

### v1.2 Business Operations (In Progress)

**Milestone Goal:** Add expense tracking, daily cash reconciliation, offline catalog and route caching, customer purchase buy-back with weighted-average costing, and customer statement enhancements.

- [x] **Phase 10: DB Foundation** - Performance indexes on the transactions table and new DB schema for expenses, cash reports, and purchases (completed 2026-03-05)
- [x] **Phase 11: Daily Cash Report** - Admin can view, navigate, and reconcile daily incoming payments and outgoing expenses across all reps (completed 2026-03-05)
- [x] **Phase 12: Expense Tracking** - Sales reps log field expenses; Admin logs business expenses and confirms or flags them (completed 2026-03-06)
- [ ] **Phase 13: Offline Caching** - Product catalog and route data cached in IndexedDB and available when the device has no connectivity
- [ ] **Phase 14: Purchase from Customer** - Sales rep buys products back from a customer, crediting their balance and updating inventory with weighted-average costing
- [ ] **Phase 15: Statement Enhancements** - Custom date range picker and Arabic PDF export for customer statements

## Phase Details

### Phase 10: DB Foundation
**Goal**: The database has the indexes and schema required for all v1.2 features to operate correctly and performantly
**Depends on**: Phase 9 (v1.1 complete)
**Requirements**: DB-01
**Success Criteria** (what must be TRUE):
  1. Transactions table has indexes on created_by, type, status, and compound (created_by, type, created_at) — query plans show index scans on reporting queries
  2. Expense rows can be persisted without errors (expenses table exists with all required columns)
  3. Daily cash report rows can be persisted without errors (daily_cash_reports table exists)
  4. The Purchase enum value exists on TransactionType and can be written to a transaction row
**Plans:** 1/1 plans complete
Plans:
- [ ] 10-01-PLAN.md — Transaction indexes, Purchase enum, Expense + DailyCashConfirmation models and migrations

### Phase 11: Daily Cash Report
**Goal**: Admin can see every day's incoming payments and outgoing expenses across all salesmen and confirm or flag each rep's cash handover
**Depends on**: Phase 10
**Requirements**: CASH-01, CASH-02, CASH-03, CASH-04, CASH-05
**Success Criteria** (what must be TRUE):
  1. Admin can open a daily cash report page showing all incoming cash and check payments and all outgoing expenses grouped by rep for any given day
  2. Admin can navigate backward and forward one day at a time to view different days' reports without a page reload
  3. Admin can confirm a salesman's cash handover for a given day, and that confirmation persists on refresh
  4. Admin can flag a discrepancy in a handover with a free-text note, and the flag is visible on the report
  5. Rep rows where the handed-over amount differs from the computed total by more than 5% are visually highlighted (distinct color or icon) without requiring any admin action
**Plans:** 2/2 plans complete
Plans:
- [ ] 11-01-PLAN.md — Backend API: schemas, aggregation service, confirm/flag endpoints
- [ ] 11-02-PLAN.md — Frontend: DailyCashReportView, admin wiring, locale keys

### Phase 12: Expense Tracking
**Goal**: Sales reps can record field expenses, Admin can record business expenses, and Admin can review and act on all submitted expenses
**Depends on**: Phase 10
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, EXP-05
**Success Criteria** (what must be TRUE):
  1. A Sales rep can submit a field expense with amount, currency, category, date, and optional notes from their mobile view
  2. An Admin can submit a business expense with the same fields from the admin panel
  3. Admin can see a list of all expenses filterable by rep, date range, and status (pending / confirmed / flagged)
  4. A Sales rep can see their own submitted expenses and their current status
  5. Admin can confirm or flag any expense with an optional note, and the status updates immediately in both the admin list and the rep's view
**Plans:** 2/2 plans complete
Plans:
- [ ] 12-01-PLAN.md — Backend: expense CRUD endpoints on ledger router (POST, GET, DELETE)
- [ ] 12-02-PLAN.md — Frontend: shared ExpenseCard component, RouteView + DailyCashReportView wiring, locale keys

### Phase 13: Offline Caching
**Goal**: A Sales rep visiting a customer with no internet connection can still browse the full product catalog and see their assigned route and today's orders
**Depends on**: Phase 10
**Requirements**: OFFL-01, OFFL-02, OFFL-03
**Success Criteria** (what must be TRUE):
  1. With connectivity, the app silently caches the product catalog in IndexedDB; after switching to airplane mode, the Sales catalog still loads and shows all products
  2. With connectivity, the app caches the rep's route customers and today's orders; after switching to airplane mode, the route view loads and shows today's customers and orders
  3. Cached data displays a "last updated" timestamp so the rep knows how fresh the offline data is
**Plans:** 2 plans
Plans:
- [ ] 13-01-PLAN.md — Cache infrastructure: idb-keyval persister, image cache, useCacheSync hook, PersistQueryClientProvider
- [ ] 13-02-PLAN.md — Sync status UI: SyncStatusCard in Sales profile tab, freshness indicators, locale keys

### Phase 14: Purchase from Customer
**Goal**: A Sales rep can record buying products back from a customer, which credits the customer's balance, increases stock, and updates the product's weighted-average purchase price
**Depends on**: Phase 10, Phase 13
**Requirements**: PURCH-01, PURCH-02, PURCH-03, PURCH-04, PURCH-05
**Success Criteria** (what must be TRUE):
  1. A Sales rep can open a "Purchase from Customer" flow, select one or more products with quantities and unit prices, and submit the purchase
  2. After a purchase, the customer's outstanding balance decreases by the purchase total (or goes negative if they are owed money)
  3. After a purchase, each purchased product's stock_qty in the catalog increases by the purchased quantity
  4. After a purchase, each product's purchase_price reflects the weighted-average of the old stock at old price and the new stock at the purchase price
  5. The purchase appears in the customer's statement as a distinct "Purchase" line item, visually differentiated from orders and payments
**Plans:** 2 plans
Plans:
- [ ] 11-01-PLAN.md — Backend API: schemas, aggregation service, confirm/flag endpoints
- [ ] 11-02-PLAN.md — Frontend: DailyCashReportView, admin wiring, locale keys

### Phase 15: Statement Enhancements
**Goal**: Users can filter a customer statement by any custom date range and download that statement as a properly rendered Arabic PDF
**Depends on**: Phase 14
**Requirements**: STMT-01, STMT-02, STMT-03
**Success Criteria** (what must be TRUE):
  1. User can select an arbitrary "from" and "to" date on the customer statement page and see only transactions in that range, with the running balance recalculated correctly
  2. User can click a download button and receive a PDF of the currently displayed statement
  3. The downloaded PDF renders Arabic customer names, Arabic column headers, and mixed Arabic/numeric amounts correctly in RTL layout
**Plans:** 2 plans
Plans:
- [ ] 11-01-PLAN.md — Backend API: schemas, aggregation service, confirm/flag endpoints
- [ ] 11-02-PLAN.md — Frontend: DailyCashReportView, admin wiring, locale keys

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Check Data Foundation | v1.1 | 2/2 | Complete | 2026-03-04 |
| 7. SVG Check Preview | v1.1 | 2/2 | Complete | 2026-03-04 |
| 8. Check Lifecycle Management | v1.1 | 2/2 | Complete | 2026-03-04 |
| 9. Image Capture and OCR | v1.1 | 4/4 | Complete | 2026-03-04 |
| 10. DB Foundation | 1/1 | Complete    | 2026-03-05 | - |
| 11. Daily Cash Report | 2/2 | Complete    | 2026-03-05 | - |
| 12. Expense Tracking | 2/2 | Complete    | 2026-03-06 | - |
| 13. Offline Caching | v1.2 | 0/TBD | Not started | - |
| 14. Purchase from Customer | v1.2 | 0/TBD | Not started | - |
| 15. Statement Enhancements | v1.2 | 0/TBD | Not started | - |
