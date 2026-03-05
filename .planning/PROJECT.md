# Alofok (Horizon)

## What This Is

A mobile-first wholesale trading app for a painting tools business. It replaces paper catalogs, handwritten receipts, and verbal debt tracking with a role-scoped digital system (Sales Reps, Designers, Admins) that works reliably in the field, including offline. Arabic-primary with RTL layout.

## Core Value

Sales Reps can visit customers, take orders, collect payments, and resolve balance disputes — even with no internet connectivity.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Project scaffold (FastAPI + React/Vite + Docker Compose) — v1.0
- ✓ Localization (Arabic RTL primary, English fallback via i18next) — v1.0
- ✓ Database models with BaseMixin (UUID, soft deletes) + Alembic migrations — v1.0
- ✓ JWT auth with role claims (Admin/Designer/Sales) — v1.0
- ✓ RBAC middleware and endpoint-level guards — v1.0
- ✓ Global error handler (HorizonException → 4xx, unhandled → Slack + 500) — v1.0
- ✓ Redis caching (catalog 10min, route 5min, insights 2min) — v1.0
- ✓ Catalog API (GET cached, POST/PUT invalidate, Designer/Admin write) — v1.0
- ✓ Route & customer management (assigned_day routing, customer insights) — v1.0
- ✓ Orders & payments API (multi-currency ILS/USD/JOD, signed amounts) — v1.0
- ✓ Returned check workflow (re-debit via Check_Return transaction) — v1.0
- ✓ Customer statement API (date range, since-zero-balance, running balance) — v1.0
- ✓ Admin stats API (sales by rep/period, debt by city/route, CSV import) — v1.0
- ✓ Daily route view (Sales landing, customer list by day) — v1.0
- ✓ Customer dashboard (debt, last collection, frequency, risk indicator) — v1.0
- ✓ Catalog & order flow (browse, search, add to order, submit) — v1.0
- ✓ Payment collection flow (cash + check forms, multi-currency) — v1.0
- ✓ Customer statement view (date presets, since-zero toggle, running balance) — v1.0
- ✓ Offline sync (IndexedDB queue, React Query cache, server-authoritative) — v1.0
- ✓ Product management UI (Designer: create/edit, images, flags) — v1.0
- ✓ Admin insights dashboard (sales charts, debt overview, overdue checks) — v1.0
- ✓ EOD report generation (per-rep daily summary to Accounting) — v1.0
- ✓ Design system rebuild (dark theme, red primary, 36+ UI components) — v1.0
- ✓ Customer portal (phone+password login, catalog, orders, statement) — v1.0
- ✓ Delivery date + route overhaul (day switcher, delivery_date on orders) — v1.0
- ✓ Admin customer reassignment, order delete/undeliver — v1.0
- ✓ Bonus orders (unassigned orders), green accent for delivered — v1.0
- ✓ Long-press multi-select for order cards — v1.0

- ✓ Enhanced check data capture (bank/branch/account numbers, holder name) — v1.1
- ✓ Live realistic check SVG preview (LTR layout, updates as user types) — v1.1
- ✓ Check lifecycle management UI (Pending → Deposited → Returned) — v1.1
- ✓ Check image capture (camera/upload, compression, IndexedDB blob store) — v1.1
- ✓ OCR auto-fill from check photo (Tesseract.js, client-side) — v1.1

### Active

<!-- Current scope. Building toward these. -->

- [ ] Database performance indexes (created_by, type, status on transactions)
- [ ] Expense tracking (salesman field expenses + admin business expenses)
- [ ] Daily cash report with payment confirmation (admin confirms/flags receipt from salesmen)
- [ ] Offline catalog caching (products available offline)
- [ ] Offline route data (customers, orders cached for daily route)
- [ ] Purchase from customer (reverse order, weighted-average purchase price, stock increase)
- [ ] Custom date intervals in customer statements
- [ ] Customer statement PDF export

### Out of Scope

<!-- Explicit boundaries. -->

- Capacitor mobile wrapper — defer to future milestone
- Notification system — deferred from v1.2, not critical yet
- Check batching/reconciliation — beyond current needs
- Check Cleared status — Deposit + Return sufficient for now

## Current Milestone: v1.2 Business Operations

**Goal:** Add expense tracking, daily cash reconciliation for admin, offline data caching, customer purchases, and statement enhancements.

**Target features:**
- Database indexes for query performance
- Expense logging for salesmen (field) and admin (business)
- Admin daily cash report with date traversal, payment confirmation/flagging
- Offline catalog and route data caching
- Purchase from customer with inventory and purchase price updates
- Custom date range picker and PDF export for customer statements

## Context

- Backend: Python FastAPI, PostgreSQL, async SQLAlchemy, Alembic, Docker Compose
- Frontend: React + Vite, Bun, shadcn/ui + Tailwind CSS, dark theme with red primary (#dc2626)
- Mobile: Capacitor planned (not yet added)
- File storage: Local filesystem via FastAPI /static mount
- State: Redis (backend), React Query + Redux Toolkit (frontend)
- All 22 original PRD features shipped and functional
- Customer portal added post-PRD with separate auth
- Delivery date routing and bonus orders added post-PRD
- Check data enhanced in v1.1: full CheckData model, SVG preview, lifecycle UI, OCR
- Transactions table missing indexes on created_by, type, status (identified pre-v1.2)
- No expense tracking exists — new model needed
- Offline sync exists for orders/payments queue but catalog not cached for offline

## Constraints

- **RTL-first**: All UI uses logical CSS properties, Arabic primary
- **Offline-first**: Sales critical path must work without connectivity
- **Soft deletes only**: No hard deletes, BaseMixin enforces is_deleted pattern
- **Signed amounts**: Transaction.amount positive = debt, negative = payment

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dark theme with red primary | Business branding, professional feel | ✓ Good |
| Separate customer_auth table | Isolate customer login from staff RBAC | ✓ Good |
| Signed transaction amounts | Simplifies balance calculation, single column | ✓ Good |
| Server-authoritative sync | Avoids complex conflict resolution | ✓ Good |
| delivery_date on Transaction | Decouple delivery scheduling from order creation | ✓ Good |

| Check data in JSONB column | Flexible schema, easy to extend without migrations | ✓ Good |
| LTR check layout | Standard check format, universal numerals | ✓ Good |
| Single transactions table (STI) | Simple statements, balance calc; proper indexes needed | ✓ Good |

---
*Last updated: 2026-03-05 after milestone v1.2 started*
