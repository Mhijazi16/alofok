---
phase: 14-purchase-from-customer
verified: 2026-03-07T14:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 14: Purchase from Customer Verification Report

**Phase Goal:** A Sales rep can record buying products back from a customer, which credits the customer's balance, increases stock, and updates the product's weighted-average purchase price
**Verified:** 2026-03-07T14:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Sales rep can open a "Purchase from Customer" flow, select one or more products with quantities and unit prices, and submit the purchase | VERIFIED | PurchaseFlow.tsx (392 lines) renders catalog browser with search, per-item editable price input, quantity controls, cart summary, notes, and ConfirmationDialog. CustomerDashboard has "purchase" action card (line 182). SalesRoot index.tsx routes view="purchase" to PurchaseFlow (line 974). POST /purchases endpoint with require_sales guard. |
| 2 | After a purchase, the customer's outstanding balance decreases by the purchase total (or goes negative if they are owed money) | VERIFIED | PurchaseService.create_purchase line 53: `customer.balance -= total`. Transaction amount is `-total` (negative, per signed-amount convention). |
| 3 | After a purchase, each purchased product's stock_qty in the catalog increases by the purchased quantity | VERIFIED | PurchaseService line 73: `product.stock_qty = old_qty + item.quantity`. FOR UPDATE lock prevents race conditions (line 63). |
| 4 | After a purchase, each product's purchase_price reflects the weighted-average of the old stock at old price and the new stock at the purchase price | VERIFIED | PurchaseService lines 77-80: WAC formula `(old_qty * old_price + item.quantity * item.unit_price) / (old_qty + item.quantity)`, guarded by `new_total_qty > 0`. |
| 5 | The purchase appears in the customer's statement as a distinct "Purchase" line item, visually differentiated from orders and payments | VERIFIED | StatementView.tsx has `if (type === "Purchase") return "info" as const` in both txTypeVariant functions (lines 87 and 95), giving a blue badge. en.json has `statement.transactionTypes.Purchase: "Purchase"` and ar.json has `"Purchase": "..."`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/schemas/transaction.py` | PurchaseItem and PurchaseCreate schemas | VERIFIED | PurchaseItem (product_id, name, quantity gt=0, unit_price gt=0) and PurchaseCreate (customer_id, items min_length=1, notes) at lines 86-96 |
| `backend/app/services/purchase_service.py` | Atomic purchase creation with balance, stock, WAC, ledger updates | VERIFIED | PurchaseService class with create_purchase method (97 lines). Handles: negative transaction amount, balance decrement, stock increment, WAC recalculation, FOR UPDATE locking, outgoing ledger entry |
| `backend/app/api/endpoints/purchases.py` | POST /purchases endpoint for Sales role | VERIFIED | router.post with response_model=TransactionOut, status_code=201, dependencies=[require_sales] |
| `backend/app/api/deps.py` | PurchaseService DI wiring | VERIFIED | get_purchase_service factory (lines 195-201), PurchaseSvc type alias (line 220) |
| `backend/app/main.py` | Router registration at /purchases | VERIFIED | `app.include_router(purchases.router, prefix="/purchases", tags=["purchases"])` at line 54 |
| `frontend/src/components/Sales/PurchaseFlow.tsx` | Catalog browser with price-editable cart for purchases | VERIFIED | 392 lines. Product search, quantity +/- controls, editable price input (starts empty), cart summary, confirmation dialog, online/offline submit |
| `frontend/src/services/salesApi.ts` | createPurchase API call and types | VERIFIED | PurchaseItem and PurchaseCreate interfaces (lines 170-181), createPurchase method at line 322 calling POST /purchases |
| `frontend/src/components/Sales/CustomerDashboard.tsx` | Purchase action card in customer actions | VERIFIED | "purchase" in CustomerAction type (line 32), action card with ArrowDownToLine icon and blue theme (line 182) |
| `frontend/src/components/Sales/StatementView.tsx` | Purchase type variant styling | VERIFIED | Both txTypeVariant functions return "info" for "Purchase" type (lines 87, 95) |
| `frontend/src/lib/syncQueue.ts` | Extended QueueItem type with purchase | VERIFIED | QueueItem.type includes "purchase" (line 14), push function signature includes "purchase" (line 39) |
| `frontend/src/hooks/useOfflineSync.ts` | Purchase flush handler | VERIFIED | Imports PurchaseCreate (line 4), handles purchase type flush via salesApi.createPurchase (lines 32-33) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| purchases.py endpoint | PurchaseService | PurchaseSvc DI | WIRED | Endpoint receives PurchaseSvc, calls service.create_purchase |
| PurchaseService | customer.balance | balance -= total | WIRED | Line 53: customer.balance -= total, then update_balance called |
| PurchaseService | product.stock_qty, product.purchase_price | WAC formula + stock increment | WIRED | Lines 73-82: stock_qty incremented, purchase_price recalculated with WAC |
| CustomerDashboard | SalesRoot index.tsx | onAction("purchase") | WIRED | handleCustomerAction accepts "purchase" (line 631), sets view to "purchase" (line 635) |
| SalesRoot index.tsx | PurchaseFlow | view === "purchase" | WIRED | Import at line 59, render branch at line 974-981 |
| PurchaseFlow | salesApi.createPurchase | useMutation / syncQueue.push | WIRED | Online: purchaseMutation.mutate(payload) at line 170. Offline: syncQueue.push("purchase", payload) at line 172 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PURCH-01 | 14-01, 14-02 | Sales rep can create a purchase from a customer by selecting products, quantities, and prices | SATISFIED | PurchaseFlow UI + POST /purchases endpoint |
| PURCH-02 | 14-01 | Purchase transaction credits the customer's balance (reduces what they owe) | SATISFIED | customer.balance -= total in PurchaseService |
| PURCH-03 | 14-01 | Purchase increases product stock_qty by the purchased quantity | SATISFIED | product.stock_qty = old_qty + item.quantity with FOR UPDATE lock |
| PURCH-04 | 14-01 | Product purchase_price is recalculated using weighted-average cost formula | SATISFIED | WAC formula in PurchaseService lines 77-80 |
| PURCH-05 | 14-02 | Purchase transactions appear in customer statement with distinct label | SATISFIED | StatementView "info" badge variant for "Purchase" type, locale keys in both ar.json and en.json |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

No TODO, FIXME, placeholder, or stub patterns found in any phase 14 artifacts. All implementations are substantive.

### Human Verification Required

### 1. Purchase Flow End-to-End

**Test:** Open Sales app, navigate to a customer, tap the Purchase (blue) action card, select products, enter prices, adjust quantities, and submit.
**Expected:** Confirmation dialog shows summary with correct total. After confirm, customer balance decreases, product stock increases in backend, purchase appears in customer statement with blue badge.
**Why human:** Requires running app with active backend/database to verify atomic transaction behavior and UI flow.

### 2. Offline Purchase Sync

**Test:** Go offline, create a purchase, go back online.
**Expected:** Purchase is queued in IndexedDB, then flushed automatically when connectivity returns. Backend reflects the purchase after sync.
**Why human:** Requires toggling network connectivity and verifying IndexedDB queue behavior.

### 3. RTL Layout and Arabic Locale

**Test:** Switch to Arabic, open purchase flow.
**Expected:** All labels in Arabic, RTL layout correct, price input and quantity controls properly aligned.
**Why human:** Visual RTL layout verification cannot be done programmatically.

### Gaps Summary

No gaps found. All 5 success criteria from ROADMAP.md are verified. All 5 PURCH requirements are satisfied. Backend service implements atomic purchase creation with signed-amount convention, balance credit, stock increment, WAC recalculation, FOR UPDATE locking, and outgoing ledger entry. Frontend provides complete purchase flow with catalog browser, editable pricing, cart management, confirmation dialog, online API calls, and offline sync queue support. Statement displays purchases with distinct blue badge variant. Full Arabic and English locale coverage.

---

_Verified: 2026-03-07T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
