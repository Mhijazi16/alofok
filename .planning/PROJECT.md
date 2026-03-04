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

### Active

<!-- Current scope. Building toward these. -->

- [ ] Enhanced check data capture (bank/branch/account numbers, holder name)
- [ ] Live realistic check SVG preview (LTR layout, updates as user types)
- [ ] Check lifecycle management UI (Pending → Deposited → Cleared / Returned)
- [ ] Check image capture (camera/upload, wire up image_url)
- [ ] OCR auto-fill from check photo

### Out of Scope

<!-- Explicit boundaries. -->

- Capacitor mobile wrapper — defer to future milestone
- Notification system — not related to check enhancement
- Check batching/reconciliation — beyond current needs

## Current Milestone: v1.1 Check Enhancement

**Goal:** Transform the basic check payment form into a rich, realistic check capture experience with full lifecycle management and OCR.

**Target features:**
- Enhanced check form with bank/branch/account numbers and holder name
- Live SVG check preview that mirrors a real bank check
- Full check status lifecycle UI (Pending → Deposited → Cleared / Returned)
- Check photo capture with image storage
- OCR auto-fill from check photos

## Context

- Backend: Python FastAPI, PostgreSQL, async SQLAlchemy, Alembic, Docker Compose
- Frontend: React + Vite, Bun, shadcn/ui + Tailwind CSS, dark theme with red primary (#dc2626)
- Mobile: Capacitor planned (not yet added)
- File storage: Local filesystem via FastAPI /static mount
- State: Redis (backend), React Query + Redux Toolkit (frontend)
- All 22 original PRD features shipped and functional
- Customer portal added post-PRD with separate auth
- Delivery date routing and bonus orders added post-PRD
- Current check data in JSONB: {bank, due_date, image_url} — needs expansion
- Check status enum exists (Pending/Deposited/Returned/Cleared) but only Return has UI

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
| LTR check layout | Standard check format, universal numerals | — Pending |

---
*Last updated: 2026-03-04 after milestone v1.1 started*
