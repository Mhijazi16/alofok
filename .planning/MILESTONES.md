# Milestones: Alofok

## v1.2 Business Operations (Shipped: 2026-03-09)

**Phases completed:** 6 phases, 11 plans, 0 tasks

**Key accomplishments:**
- Database performance indexes on transactions table + expense/cash report schema foundation
- Admin daily cash report with date navigation, per-rep confirm/flag workflow, Finance tab
- Expense tracking for Sales field expenses and Admin business expenses with shared ExpenseCard
- Offline catalog and route caching via IndexedDB + React Query persistence with freshness indicators
- Purchase from customer with weighted-average costing, stock increase, and ledger entries
- Custom date range picker and Arabic PDF/HTML export for customer statements

---

## v1.0 — Core Trading Platform

**Shipped:** 2026-03-04
**Phases:** 1–5 (pre-GSD, tracked via Feature.json)

### What Shipped
- Full backend: auth, RBAC, catalog, orders, payments, returned checks, statements, admin stats, EOD reports
- Full frontend: Sales (route, dashboard, catalog, orders, payments, statements, offline sync), Designer (product management), Admin (insights dashboard)
- Design system: dark theme, red primary, 36+ UI components, RTL-first
- Customer portal: separate auth, catalog browsing, order drafts, statements
- Delivery date routing, bonus orders, multi-select order cards
- Admin: customer reassignment, order delete/undeliver

### Validated Decisions
- Dark theme + red primary branding
- Separate customer auth
- Signed transaction amounts
- Server-authoritative offline sync
- delivery_date on Transaction model

---
*Last phase number: 5*
