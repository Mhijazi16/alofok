# Check Detail View & Returned-Check Warnings

**Date:** 2026-03-04
**Scope:** Admin check detail dialog, salesman returned-check warnings

## Features

### 1. Admin Check Cards — Icon + Click-to-Detail

- Add `FileCheck2` icon to each check card in `AdminChecksView`, left of customer name
- Clicking card opens `CheckDetailDialog`:
  - Header: customer name + status badge
  - Info grid: amount, currency, bank, branch, account, holder, due date
  - `CheckPreview` SVG filled with check data (no `focusedField`)
  - Action buttons (deposit/return) at dialog bottom, same logic as current cards

### 2. CheckDetailDialog — Shared Component

New component: `frontend/src/components/ui/check-detail-dialog.tsx`

Props:
- `check: CheckOut | null` — the check to display
- `open: boolean` / `onOpenChange`
- `onDeposit?: (id: string) => void` — optional, shown if check is Pending
- `onReturn?: (id: string) => void` — optional, shown if Pending or Deposited
- `navigation?: { onPrev?: () => void; onNext?: () => void; current: number; total: number }` — optional prev/next for multi-check browsing

Layout:
1. Dialog header: customer name, status badge
2. CheckPreview SVG (read-only, data from `check.data`)
3. Info grid (2-col): bank, branch, account, holder, due date, amount, currency
4. Footer: action buttons (conditional on status) or navigation arrows

### 3. Salesman Returned-Check Warning

**A. Route list customer cards:**
- Small red `AlertTriangle` icon + count badge on customer cards with returned checks
- Data source: `returned_checks_count` field added to customer list response

**B. CustomerDashboard:**
- Destructive-styled glass card at top (before insight stats)
- `AlertTriangle` icon + "X returned check(s)" text
- Tapping opens `CheckDetailDialog` with the returned check(s)
- Prev/next navigation if multiple returned checks

### 4. Backend

**New endpoint:** `GET /customers/{id}/returned-checks`
- Returns `CheckOut[]` filtered to `status=Returned`
- Accessible by Sales + Admin
- Reuses existing `get_all_checks()` logic with customer_id + status filter

**Customer list enrichment:**
- Add `returned_checks_count: int` to `CustomerOut` schema
- Computed via subquery in customer list queries
- Enables route list to show warning badges without extra API calls

## Files Modified

### Backend
- `backend/app/services/payment_service.py` — add `get_customer_returned_checks()`
- `backend/app/api/endpoints/payments.py` — add `GET /customers/{id}/returned-checks`
- `backend/app/schemas/customer.py` — add `returned_checks_count` to `CustomerOut`
- `backend/app/services/customer_service.py` — enrich customer queries with returned check count

### Frontend
- `frontend/src/components/ui/check-detail-dialog.tsx` — new shared component
- `frontend/src/components/Admin/AdminChecksView.tsx` — add icon, click handler, dialog
- `frontend/src/components/Sales/CustomerDashboard.tsx` — returned-check warning card + dialog
- `frontend/src/components/Sales/RouteView.tsx` — returned-check badge on customer cards
- `frontend/src/services/salesApi.ts` — add `getReturnedChecks()` method
- `frontend/src/locales/en.json` — new keys for warnings/dialog
- `frontend/src/locales/ar.json` — Arabic translations

## Decisions

- `CheckDetailDialog` is shared between Admin and Sales (same component, different action props)
- `CheckPreview` reused as-is with data from `CheckOut.data`
- `returned_checks_count` on CustomerOut avoids N+1 queries in route list
- Dedicated endpoint for returned checks (not piggybacking on insights)
