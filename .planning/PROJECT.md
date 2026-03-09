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

- ✓ Database performance indexes (created_by, type, status on transactions) — v1.2
- ✓ Expense tracking (salesman field expenses + admin business expenses) — v1.2
- ✓ Daily cash report with payment confirmation (admin confirms/flags receipt from salesmen) — v1.2
- ✓ Offline catalog caching (products available offline) — v1.2
- ✓ Offline route data (customers, orders cached for daily route) — v1.2
- ✓ Purchase from customer (reverse order, weighted-average purchase price, stock increase) — v1.2
- ✓ Custom date intervals in customer statements — v1.2
- ✓ Customer statement PDF export — v1.2

### Active

<!-- Next milestone scope. -->

(None yet — define with `/gsd:new-milestone`)

### Out of Scope

<!-- Explicit boundaries. -->

- Capacitor mobile wrapper — defer to future milestone
- Notification system — deferred from v1.2, not critical yet
- Check batching/reconciliation — beyond current needs
- Check Cleared status — Deposit + Return sufficient for now

## Current State

v1.2 shipped. 3 milestones complete (v1.0 Core, v1.1 Checks, v1.2 Business Operations).

## Context

- Backend: Python FastAPI, PostgreSQL, async SQLAlchemy, Alembic, Docker Compose
- Frontend: React + Vite, Bun, shadcn/ui + Tailwind CSS, dark theme with red primary (#dc2626)
- Mobile: Capacitor planned (not yet added)
- File storage: Local filesystem via FastAPI /static mount
- State: Redis (backend), React Query + Redux Toolkit (frontend)
- All 22 original PRD features + customer portal + delivery routing + check enhancements shipped
- Expense tracking, daily cash report, offline caching, purchase from customer, statement PDF all shipped in v1.2
- 119 files, ~16,700 lines added in v1.2

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
| Expenses in separate table (not transactions) | Prevents statement/balance pollution | ✓ Good |
| Client-side PDF via @react-pdf/renderer + HTML fallback | Offline-first, avoids server dependency | ✓ Good |
| idb-keyval + React Query persist for offline | Lightweight, 24h gcTime, whitelist approach | ✓ Good |
| WAC with FOR UPDATE lock | Prevents concurrent sync race conditions on purchase | ✓ Good |
| Purchase as TransactionType enum value | Reuses STI pattern, appears in statements naturally | ✓ Good |

---
*Last updated: 2026-03-09 after v1.2 milestone complete*
