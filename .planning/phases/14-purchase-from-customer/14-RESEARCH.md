# Phase 14: Purchase from Customer - Research

**Researched:** 2026-03-07
**Domain:** Reverse transaction flow (buy-back from customer), WAC recalculation, offline sync extension
**Confidence:** HIGH

## Summary

Phase 14 implements a "Purchase from Customer" flow that mirrors the existing Order flow in reverse. A Sales rep selects products with quantities and custom prices, submits a purchase, which creates a negative-amount transaction (crediting the customer), increases product stock, and recalculates the product's weighted-average cost (WAC). The purchase also creates a ledger entry for daily cash report visibility.

The codebase already has all foundational pieces in place: `TransactionType.Purchase` enum value (Phase 10), `Product.purchase_price` and `Product.stock_qty` fields, the signed-amount convention (negative = credit), the offline sync queue, and the cart/catalog browsing UI. The work is primarily wiring these together with a new backend service, a new API endpoint, a new frontend PurchaseFlow component (adapted from OrderFlow), and integration points in CustomerDashboard, StatementView, the sync queue, and the daily cash report.

**Primary recommendation:** Create a PurchaseService mirroring OrderService that handles the atomic operation (create transaction + update customer balance + update product stock/WAC + create ledger entry), a `/purchases` API router, a PurchaseFlow frontend component adapted from OrderFlow (removing options, adding price input), and wire everything into existing integration points.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New "Purchase" action button on CustomerDashboard alongside existing Order/Payment/Statement/Check actions
- Any customer can be purchased from -- no restrictions by balance or admin flag
- Purchases work offline, queued in sync queue like orders -- server resolves WAC on sync
- Reuse existing OrderFlow catalog browser with cart pattern (familiar, catalog already cached offline)
- No product options (sizes/colors) -- purchases operate at the base product level only
- Rep enters a custom price per item (negotiated buy-back price) -- no fixed default needed, field is editable
- WAC formula applied server-side: (old_qty * old_price + new_qty * new_price) / (old_qty + new_qty)
- Selling price is never affected by purchases -- only purchase_price changes
- Simple summary before submit: list of products with qty x price, grand total credit amount
- No WAC preview -- keep it clean and quick
- ILS only -- no multi-currency support for purchases
- Balance credit only -- no cash changes hands. Customer's debt decreases, no physical cash outflow
- Optional notes field on the purchase (same as orders)
- Distinct color (not red/green) + "Purchase" label to differentiate from orders and payments in statement
- Negative signed amount (credits customer, reduces running balance) -- consistent with signed-amount convention
- Shows total amount + notes if present -- no product breakdown in statement view
- Product details stored in transaction.data JSONB for reference
- Purchases appear in Admin's Daily Cash Report as outgoing/balance-adjustment items grouped under the rep

### Claude's Discretion
- Purchase button icon and accent color on CustomerDashboard
- Purchase cart UI adaptations (removing option picker, adding price input field)
- Statement line color choice (something distinct from order red and payment green)
- Loading states and error handling
- Offline queue implementation details (reuse existing sync patterns)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PURCH-01 | Sales rep can create a purchase from a customer by selecting products, quantities, and prices | PurchaseFlow component (adapted OrderFlow), PurchaseCreate schema, `/purchases` endpoint, PurchaseService |
| PURCH-02 | Purchase transaction credits the customer's balance (reduces what they owe) | Negative signed amount on Transaction, `customer.balance -= total` in PurchaseService (mirrors PaymentService pattern) |
| PURCH-03 | Purchase increases product stock_qty by the purchased quantity | `product.stock_qty += item.quantity` in PurchaseService for each line item |
| PURCH-04 | Product purchase_price is recalculated using weighted-average cost formula | WAC formula in PurchaseService: `(old_qty * old_price + new_qty * new_price) / (old_qty + new_qty)` |
| PURCH-05 | Purchase transactions appear in customer statement with distinct label | Add "Purchase" to transactionTypes locale keys, add distinct color variant in StatementView and CustomerDashboard txTypeVariant functions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | existing | Purchase API endpoint | Project backend framework |
| SQLAlchemy Async | existing | Product stock/WAC updates within transaction | Project ORM |
| React | existing | PurchaseFlow UI component | Project frontend framework |
| @tanstack/react-query | existing | Mutation + cache invalidation for purchase | Already used for all API calls |
| i18next | existing | ar/en locale keys for purchase | Already used for all UI strings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Purchase button icon (e.g., `ArrowDownToLine` or `PackagePlus`) | Icon for CustomerDashboard action card |
| idb-keyval / IndexedDB | existing | Offline queue for purchase sync | When offline, queue purchase like orders |

### Alternatives Considered
None -- all decisions are locked, using existing stack entirely.

**Installation:**
No new dependencies needed. All libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
  api/endpoints/purchases.py    # New router (POST /purchases)
  services/purchase_service.py  # New service (create_purchase with WAC + stock + ledger)
  schemas/transaction.py        # Add PurchaseCreate schema

frontend/src/
  components/Sales/PurchaseFlow.tsx  # New component (adapted from OrderFlow)
  components/Sales/index.tsx         # Add "purchase" view type + routing
  components/Sales/CustomerDashboard.tsx  # Add "purchase" action card
  components/Sales/StatementView.tsx     # Add Purchase type color variant
  services/salesApi.ts               # Add createPurchase + PurchaseItem types
  hooks/useOfflineSync.ts            # Add "purchase" to flush handler
  lib/syncQueue.ts                   # Extend QueueItem type
  locales/ar.json + en.json          # Add Purchase locale keys
```

### Pattern 1: PurchaseService (mirrors OrderService + PaymentService hybrid)
**What:** A service that atomically creates a Purchase transaction, updates customer balance, updates product stock and WAC, and creates a ledger entry.
**When to use:** Every purchase submission (online or offline sync).
**Example:**
```python
# Based on existing OrderService.create_order and PaymentService.create_payment patterns
class PurchaseService:
    def __init__(self, customer_repo, transaction_repo, product_repo, ledger_repo):
        ...

    async def create_purchase(self, body: PurchaseCreate, creator_id: uuid.UUID):
        customer = await self._customers.get_by_id(body.customer_id)
        # Validate
        total = sum(Decimal(str(item.quantity)) * Decimal(str(item.unit_price)) for item in body.items)

        # Create transaction with NEGATIVE amount (credits customer)
        txn = Transaction(
            customer_id=body.customer_id,
            created_by=creator_id,
            type=TransactionType.Purchase,
            currency=Currency.ILS,
            amount=-total,  # negative = credit
            data={"items": [item.dict() for item in body.items]},
            notes=body.notes,
        )
        customer.balance -= total  # reduce debt
        await self._customers.update_balance(customer)
        txn = await self._transactions.create(txn)

        # Update each product's stock and WAC
        for item in body.items:
            product = await self._products.get_by_id(item.product_id)
            old_qty = product.stock_qty or 0
            old_price = product.purchase_price or Decimal("0")
            new_qty = item.quantity
            new_price = Decimal(str(item.unit_price))

            product.stock_qty = old_qty + new_qty
            if old_qty + new_qty > 0:
                product.purchase_price = (
                    old_qty * old_price + new_qty * new_price
                ) / (old_qty + new_qty)
            await self._products.update(product)

        # Create ledger entry (outgoing / balance-adjustment)
        ledger_entry = CompanyLedger(
            direction="outgoing",
            payment_method="balance_adjustment",
            amount=total,
            rep_id=creator_id,
            customer_id=body.customer_id,
            source_transaction_id=txn.id,
            date=txn.created_at.date(),
            status="pending",
        )
        await self._ledger.create(ledger_entry)

        return TransactionOut.model_validate(txn)
```

### Pattern 2: PurchaseFlow Component (adapted OrderFlow)
**What:** Catalog browser with simplified cart -- no option picker, adds editable price input per item.
**When to use:** When Sales rep selects "purchase" action from CustomerDashboard.
**Key differences from OrderFlow:**
- No `OptionPickerDialog` -- purchases are base product only
- Each cart item has an editable `unitPrice` field (not product.price)
- Cart total uses custom prices, not catalog prices
- Submit creates purchase (negative amount), not order (positive amount)
- Confirmation shows credit amount, not debt amount

### Pattern 3: Offline Sync Extension
**What:** Add "purchase" as a third type in the sync queue alongside "order" and "payment".
**When to use:** When Sales rep creates purchase while offline.
**Key changes:**
- `syncQueue.push("purchase", payload)` -- new queue type
- `useOfflineSync.flush()` adds `if (item.type === "purchase") { await salesApi.createPurchase(...) }` branch
- `QueueItem.type` union extends to `"order" | "payment" | "purchase"`

### Anti-Patterns to Avoid
- **Client-side WAC calculation:** WAC must be computed server-side only. If two purchases sync simultaneously, client-side WAC would be wrong. Server has the authoritative stock_qty and purchase_price.
- **Sharing cart state between orders and purchases:** The purchase cart must be entirely separate from the order cart. Different data structure (custom price per item vs catalog price), different submission flow.
- **Using `product.price` as default purchase price:** The context explicitly says "no fixed default needed, field is editable." Start with an empty price field that the rep must fill in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Catalog browsing | New product list | Adapt existing OrderFlow's product query + rendering | Already cached in IndexedDB, familiar UX |
| Cart state management | New cart abstraction | Adapt existing Map-based cart pattern from Sales/index.tsx | Proven pattern, localStorage persistence |
| Offline queueing | New offline mechanism | Extend existing syncQueue + useOfflineSync | Already handles orders/payments, add purchase branch |
| Balance update | Manual SQL | Use existing `CustomerRepository.update_balance()` | Consistent with order/payment flows |
| Product update | Manual SQL | Use existing `ProductRepository.update()` | Auto-commits and refreshes |

## Common Pitfalls

### Pitfall 1: WAC Division by Zero
**What goes wrong:** If both `old_qty` and `new_qty` are 0, division by zero in WAC formula.
**Why it happens:** Product has no stock and purchase of 0 quantity (shouldn't happen but defensive coding).
**How to avoid:** Guard with `if (old_qty + new_qty) > 0` before WAC calculation. Also validate `item.quantity > 0` in schema.
**Warning signs:** 500 errors on purchase creation.

### Pitfall 2: Null stock_qty or purchase_price
**What goes wrong:** `Product.stock_qty` and `Product.purchase_price` are nullable. Arithmetic with `None` will crash.
**Why it happens:** Products created before Phase 14 may have null values.
**How to avoid:** Default to 0 when null: `old_qty = product.stock_qty or 0`, `old_price = product.purchase_price or Decimal("0")`.
**Warning signs:** TypeError in purchase service.

### Pitfall 3: Race Condition on Stock Update
**What goes wrong:** Two purchases sync simultaneously, both read the same stock_qty, both write different values, one overwrite is lost.
**Why it happens:** Read-modify-write without locking.
**How to avoid:** Use `SELECT ... FOR UPDATE` or SQLAlchemy's `with_for_update()` when reading the product in the purchase service. Alternatively, use atomic SQL increment: `UPDATE products SET stock_qty = stock_qty + :qty`.
**Warning signs:** Stock counts not matching expected values after bulk sync.

### Pitfall 4: Forgetting to Invalidate Product Cache
**What goes wrong:** After a purchase, the product catalog in React Query cache still shows old stock_qty.
**Why it happens:** Only customer-related queries are invalidated.
**How to avoid:** Invalidate `["products"]` query key after purchase mutation succeeds.
**Warning signs:** Stale stock counts in catalog until manual refresh.

### Pitfall 5: Sync Queue Type Not Handled
**What goes wrong:** Purchase queued offline but `useOfflineSync.flush()` doesn't handle "purchase" type, silently skips it.
**Why it happens:** Forgot to add the purchase branch in the flush function.
**How to avoid:** Add explicit `else if (item.type === "purchase")` handler. TypeScript union type change will catch missing cases if switch/exhaustive check is used.
**Warning signs:** Purchases disappear from queue but never reach server.

## Code Examples

### Backend: PurchaseCreate Schema
```python
# In app/schemas/transaction.py
class PurchaseItem(BaseModel):
    product_id: uuid.UUID
    name: str
    quantity: int
    unit_price: Decimal  # negotiated buy-back price

class PurchaseCreate(BaseModel):
    customer_id: uuid.UUID
    items: list[PurchaseItem]
    notes: str | None = None
```

### Backend: Router Registration
```python
# In app/api/endpoints/purchases.py
router = APIRouter()

@router.post("", response_model=TransactionOut, status_code=201, dependencies=[require_sales])
async def create_purchase(
    body: PurchaseCreate, current_user: CurrentUser, service: PurchaseSvc
) -> TransactionOut:
    return await service.create_purchase(body, uuid.UUID(current_user["sub"]))
```

### Backend: Dependency Injection
```python
# In app/api/deps.py - add:
from app.services.purchase_service import PurchaseService

def get_purchase_service(
    customer_repo: CustomerRepo,
    transaction_repo: TransactionRepo,
    product_repo: ProductRepo,
    ledger_repo: LedgerRepo,
) -> PurchaseService:
    return PurchaseService(customer_repo, transaction_repo, product_repo, ledger_repo)

PurchaseSvc = Annotated[PurchaseService, Depends(get_purchase_service)]
```

### Frontend: salesApi Extension
```typescript
// In services/salesApi.ts - add:
export interface PurchaseItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface PurchaseCreate {
  customer_id: string;
  items: PurchaseItem[];
  notes?: string;
}

// In salesApi object:
createPurchase: (payload: PurchaseCreate) =>
  api.post<Transaction>("/purchases", payload).then((r) => r.data),
```

### Frontend: CustomerDashboard Action Card Addition
```typescript
// Extend CustomerAction type:
type CustomerAction = "order" | "payment" | "statement" | "check" | "purchase";

// Add to actionCards array (Claude's discretion on icon/color):
{
  key: "purchase",
  icon: ArrowDownToLine,  // or PackagePlus
  label: t("actions.purchase"),
  accent: "hover:border-blue-500/50",  // distinct from red order, green payment
  iconBg: "bg-blue-500/15 text-blue-400",
}
```

### Frontend: Statement Type Variant for Purchase
```typescript
// In StatementView and CustomerDashboard txTypeVariant functions:
const txTypeVariant = (type: string) => {
  if (type === "Order") return "warning" as const;
  if (type.startsWith("Payment")) return "success" as const;
  if (type === "Check_Return") return "destructive" as const;
  if (type === "Purchase") return "info" as const;  // blue/distinct color
  return "default" as const;
};
```

### Frontend: Sync Queue Extension
```typescript
// In syncQueue.ts:
export interface QueueItem {
  id?: number;
  type: "order" | "payment" | "purchase";
  payload: unknown;
  created_at: string;
}

// In useOfflineSync.ts flush():
if (item.type === "order") {
  await salesApi.createOrder(item.payload as OrderCreate);
} else if (item.type === "purchase") {
  await salesApi.createPurchase(item.payload as PurchaseCreate);
} else {
  // existing payment handling...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No purchase support | Purchase enum added in Phase 10 | Phase 10 (2026-03-05) | DB ready, just needs service layer |
| No offline sync | IndexedDB sync queue (Phase 13) | Phase 13 (2026-03-06) | Purchase can ride existing offline infra |

**Already in place:**
- `TransactionType.Purchase` enum value in both Python and PostgreSQL
- `Product.purchase_price` (Numeric 12,2) and `Product.stock_qty` (Integer) fields
- Signed amount convention: negative = credit (used by payments)
- CompanyLedger model and daily cash report for outgoing entries
- Cart pattern (Map-based, localStorage-persisted) in Sales/index.tsx

## Open Questions

1. **Ledger payment_method value for purchases**
   - What we know: Existing ledger entries use "cash" or "check" for payment_method. Purchases are balance adjustments, not physical cash.
   - What's unclear: Should a new `payment_method` value like "balance_adjustment" or "purchase" be used?
   - Recommendation: Use "balance_adjustment" -- clearly communicates no physical cash changed hands. Verify the daily cash report query handles this value in its grouping.

2. **Product stock_qty type safety**
   - What we know: `stock_qty` is `Optional[int]` in the model, many products may have `None`.
   - What's unclear: Should we set a default value for existing products?
   - Recommendation: Handle `None` as `0` in the service layer. No migration needed -- defensive coding is sufficient.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend), vitest (frontend -- not configured) |
| Config file | backend: pytest in pyproject.toml / frontend: none detected |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PURCH-01 | Create purchase endpoint returns 201 with correct data | unit | `pytest tests/test_purchases.py::test_create_purchase -x` | No -- Wave 0 |
| PURCH-02 | Customer balance decreases by purchase total | unit | `pytest tests/test_purchases.py::test_balance_credit -x` | No -- Wave 0 |
| PURCH-03 | Product stock_qty increases by purchased quantity | unit | `pytest tests/test_purchases.py::test_stock_increase -x` | No -- Wave 0 |
| PURCH-04 | Product purchase_price reflects WAC formula | unit | `pytest tests/test_purchases.py::test_wac_recalculation -x` | No -- Wave 0 |
| PURCH-05 | Purchase appears in statement with Purchase type | integration | Manual -- verify StatementView renders Purchase badge | Manual-only: UI rendering |

### Sampling Rate
- **Per task commit:** `bun build` (frontend) + `black --check backend/` (backend)
- **Per wave merge:** Full build clean check
- **Phase gate:** `bun build` + `tsc --noEmit` + manual smoke test of purchase flow

### Wave 0 Gaps
- [ ] `backend/tests/test_purchases.py` -- covers PURCH-01 through PURCH-04
- [ ] Test fixtures for product with stock_qty/purchase_price setup
- [ ] Note: No existing test infrastructure detected in backend/tests/; may need conftest.py setup

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/app/models/transaction.py` -- TransactionType.Purchase enum exists
- Codebase inspection: `backend/app/models/product.py` -- purchase_price and stock_qty fields exist
- Codebase inspection: `backend/app/services/order_service.py` -- create_order pattern (transaction + balance update)
- Codebase inspection: `backend/app/services/payment_service.py` -- negative amount + ledger entry pattern
- Codebase inspection: `frontend/src/components/Sales/OrderFlow.tsx` -- catalog browse + cart pattern
- Codebase inspection: `frontend/src/components/Sales/index.tsx` -- View routing, cart state, offline sync handling
- Codebase inspection: `frontend/src/lib/syncQueue.ts` -- IndexedDB queue with type union
- Codebase inspection: `frontend/src/hooks/useOfflineSync.ts` -- flush handler with type branching
- Codebase inspection: `frontend/src/components/Sales/CustomerDashboard.tsx` -- action cards array
- Codebase inspection: `frontend/src/components/Sales/StatementView.tsx` -- txTypeVariant coloring
- Codebase inspection: `frontend/src/locales/ar.json` + `en.json` -- transactionTypes keys (Purchase missing)

### Secondary (MEDIUM confidence)
- CONTEXT.md user decisions -- all implementation details locked by user discussion

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- entirely existing stack, no new libraries
- Architecture: HIGH -- direct mirror of existing Order/Payment patterns with clear code examples
- Pitfalls: HIGH -- identified from actual nullable columns and race condition patterns in the codebase

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- no external dependencies, all internal codebase patterns)
