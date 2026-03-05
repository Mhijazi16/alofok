# Architecture Research

**Domain:** Wholesale trading app — v1.2 Business Operations
**Researched:** 2026-03-05
**Confidence:** HIGH (existing codebase inspected directly)

---

## Existing Architecture Baseline

Current backend structure (`backend/app/`):

```
api/endpoints/    admin.py, auth.py, customers.py, orders.py, payments.py, products.py
services/         admin_service.py, auth_service.py, catalog_service.py,
                  customer_service.py, order_service.py, payment_service.py
repositories/     customer_repository.py, transaction_repository.py, ...
models/           customer.py, product.py, transaction.py, user.py, customer_auth.py
schemas/          (per domain)
```

Current frontend structure (`frontend/src/`):

```
components/Sales/   RouteView, OrderFlow, PaymentFlow, StatementView, CustomerDashboard,
                    AllCustomersView, CheckCapture, CheckPreview, ReturnedChecksView
components/Admin/   Overview, SalesStats, DebtStats, AdminChecksView, AdminCustomerPanel
services/           salesApi.ts, adminApi.ts, designerApi.ts, customerApi.ts
lib/                syncQueue.ts (IndexedDB — mutations), checkImageQueue.ts, cart.ts
hooks/              useOfflineSync.ts, useToast.ts, useTheme.ts
store/              authSlice.ts
```

Key existing patterns to carry forward:
- `BaseMixin` gives every model: `id` (UUID), `created_at`, `updated_at`, `is_deleted` (soft delete)
- `Transaction.amount` is signed — positive = customer owes money, negative = payment/credit
- `Transaction.data` is JSONB for flexible metadata (already used for check details)
- `TransactionType` is a SQLAlchemy enum — adding values requires an Alembic migration
- IndexedDB DB name: `alofok_offline`, version 2, stores: `sync_queue`, `check_images`
- React Query manages server-state cache; Redux Toolkit manages auth + UI state

---

## System Overview: Post-v1.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          React Frontend (Vite)                           │
├──────────────┬──────────────┬──────────────┬────────────────────────────┤
│  Sales/      │  Admin/      │  Designer/   │  Customer/                 │
│  Components  │  Components  │  Components  │  Components                │
│  +Expense    │  +DailyCash  │  (unchanged) │  (unchanged)               │
│  +Purchase   │   Report     │              │                            │
├──────────────┴──────────────┴──────────────┴────────────────────────────┤
│           Service Layer (salesApi, adminApi — extended)                  │
├─────────────────────────────────────────────────────────────────────────┤
│           React Query (server-state + stale-while-revalidate)           │
│           Redux Toolkit (auth + UI state)                                │
├─────────────────────┬───────────────────────────────────────────────────┤
│  IndexedDB          │  React Query cache (catalog, route — NEW)         │
│  sync_queue  (mut.) │  with placeholderData from offlineCache.ts        │
│  check_images(blob) │                                                   │
│  catalog_cache (NEW)│                                                   │
│  route_cache   (NEW)│                                                   │
└─────────────────────┴─────────────────────────────────────────────────-─┘
                              HTTP / Bearer JWT
┌─────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend                                   │
│   GZip → GlobalErrorHandler → AuthMiddleware → Endpoints                │
├──────────────┬───────────────┬──────────────┬──────────────────────────┤
│  api/        │  services/    │  repositories│  models/                 │
│  endpoints/  │  (business    │  (async SA   │  (BaseMixin,             │
│  +expenses   │   logic)      │   queries)   │   +Expense,              │
│  +purchases  │  +ExpenseSvc  │  +ExpenseRepo│   +DailyCashReport)      │
│              │  +PurchaseSvc │              │                          │
│              │  AdminSvc ext.│              │                          │
├──────────────┴───────────────┴──────────────┴──────────────────────────┤
│                    Redis (TTL cache — catalog, route, insights)          │
├─────────────────────────────────────────────────────────────────────────┤
│                PostgreSQL (authoritative — +expenses, +daily_cash_reports│
│                +Purchase enum value, +partial indexes on transactions)   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## New Models Required

### 1. Expense — New table

The `Transaction` model is **customer-scoped** (`customer_id` NOT NULL) and carries signed-amount balance semantics. Expenses have no customer, no balance effect, and need an admin approval workflow. Mixing them into the transactions STI table would require nullable `customer_id` and would pollute customer statement queries.

```python
# backend/app/models/expense.py

class ExpenseCategory(str, enum.Enum):
    Field = "Field"        # salesman field expenses (fuel, parking, meals)
    Business = "Business"  # admin business expenses (rent, utilities, supplies)

class Expense(BaseMixin, Base):
    __tablename__ = "expenses"

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    category: Mapped[ExpenseCategory] = mapped_column(
        SAEnum(ExpenseCategory, name="expensecategory"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[Currency] = mapped_column(
        SAEnum(Currency, name="currency"), default=Currency.ILS, nullable=False
    )
    description: Mapped[str] = mapped_column(String, nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    receipt_url: Mapped[str | None] = mapped_column(String, nullable=True)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(String, default="pending")  # pending|confirmed|rejected
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
```

### 2. DailyCashReport — New table

Admin physically confirms that cash/checks collected by a salesman on a given day were received. This is an audit record separate from the transactions themselves. A JSONB snapshot is stored at generation time so the record remains stable even if transactions are later soft-deleted.

```python
# backend/app/models/daily_cash_report.py

class DailyCashReport(BaseMixin, Base):
    __tablename__ = "daily_cash_reports"

    report_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    sales_rep_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    # Snapshot: {cash_ils, cash_usd, cash_jod, check_count, check_total_ils,
    #            transaction_ids: [...], expenses_total: ...}
    summary: Mapped[dict] = mapped_column(JSONB, nullable=False)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(String, default="pending")  # pending|confirmed|flagged
    notes: Mapped[str | None] = mapped_column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint("report_date", "sales_rep_id", name="uq_daily_cash_report"),
    )
```

The `UniqueConstraint` prevents duplicate reports. Generation uses `INSERT ... ON CONFLICT DO UPDATE` (upsert) so calling the endpoint again re-computes the snapshot until it is confirmed.

### 3. Transaction model — enum extension

Add `Purchase` to `TransactionType`. This requires an Alembic migration to ALTER the PostgreSQL enum type.

```python
class TransactionType(str, enum.Enum):
    Order = "Order"
    Payment_Cash = "Payment_Cash"
    Payment_Check = "Payment_Check"
    Check_Return = "Check_Return"
    Opening_Balance = "Opening_Balance"
    Purchase = "Purchase"   # NEW — reverse order, stock in, WAC update
```

`Purchase` transactions carry a **negative** amount (money paid to the customer, reducing their balance or creating a credit). The `data` JSONB field stores line items and the WAC snapshot at time of purchase.

### 4. Product model — no schema changes

`purchase_price` (Numeric 12,2, nullable) and `stock_qty` (Integer, nullable) already exist. WAC logic lives entirely in the service layer.

### 5. Missing indexes — Performance fix (Alembic migration)

```sql
-- Partial indexes exclude soft-deleted rows (all queries filter is_deleted = FALSE)
CREATE INDEX ix_transactions_created_by
    ON transactions (created_by) WHERE is_deleted = FALSE;

CREATE INDEX ix_transactions_type
    ON transactions (type) WHERE is_deleted = FALSE;

CREATE INDEX ix_transactions_status
    ON transactions (status) WHERE is_deleted = FALSE;
```

---

## New / Modified Endpoints

### expenses.py — New router

```
POST  /expenses                         Sales: log a field expense
GET   /expenses/my?start_date=&end_date= Sales: list own expenses
GET   /admin/expenses?rep_id=&date=      Admin: list expenses with filters
PUT   /admin/expenses/{id}/confirm       Admin: confirm expense
PUT   /admin/expenses/{id}/reject        Admin: reject with note
POST  /expenses/receipt-upload           Sales: upload receipt image (same pattern as check image upload)
```

### admin.py — Extend existing router

```
POST  /admin/reports/daily-cash                   Generate/refresh report for a rep+date
GET   /admin/reports/daily-cash?date=&rep_id=     List reports with filters
PUT   /admin/reports/daily-cash/{id}/confirm       Confirm receipt
PUT   /admin/reports/daily-cash/{id}/flag          Flag discrepancy with note
```

### purchases.py — New router

```
POST  /purchases    Sales: create a purchase-from-customer transaction
```

The purchase endpoint calls `PurchaseService` which wraps all writes in a single database transaction:
1. Validate customer exists
2. For each line item: load `Product` with `SELECT FOR UPDATE`, compute WAC, update `stock_qty` and `purchase_price`
3. Create `Transaction(type=Purchase, amount=negative, data=line_items_snapshot)`
4. Update `customer.balance += amount` (negative amount reduces balance / creates credit)

### products.py — Minor extension

```
GET   /products/offline-snapshot    Full catalog for local cache (no pagination)
```

Cached in Redis at 30-minute TTL. Same shape as existing catalog list response. This endpoint exists so the frontend can fetch the full catalog in a single request for IndexedDB hydration.

### customers.py — Minor extension

```
GET   /customers/{id}/statement/pdf?start_date=&end_date=    Returns PDF binary
```

Uses `weasyprint` + Jinja2 HTML template. Returns `Content-Type: application/pdf`. The Docker image must include `weasyprint` system dependencies and Noto Arabic fonts.

---

## Frontend Architecture Changes

### Offline Catalog + Route Caching

The current `syncQueue` IndexedDB database handles mutation queuing. Catalog and route data are **read-only** and benefit from React Query's persistent cache backed by IndexedDB.

Approach: bump IndexedDB version to 3, add `catalog_cache` and `route_cache` object stores. A new `lib/offlineCache.ts` module wraps access. React Query uses `placeholderData` to serve stale IndexedDB data while network fetch is in progress or unavailable.

```typescript
// lib/offlineCache.ts (NEW FILE)
// Shares the openDB() helper with syncQueue — same DB, different stores

const VERSION = 3; // was 2 in syncQueue.ts

export const offlineCache = {
  saveCatalog(products: Product[]): Promise<void>,   // writes to "catalog_cache" store
  loadCatalog(): Promise<Product[] | null>,           // reads from "catalog_cache" store
  saveRoute(date: string, data: RouteData): Promise<void>,
  loadRoute(date: string): Promise<RouteData | null>,
}
```

React Query integration in existing hooks:

```typescript
// In RouteView or a shared hook
const cachedCatalog = useRef<Product[] | null>(null);

// On mount, load from IndexedDB
useEffect(() => {
  offlineCache.loadCatalog().then(d => { cachedCatalog.current = d });
}, []);

const { data: products } = useQuery({
  queryKey: ["catalog"],
  queryFn: () => salesApi.getOfflineSnapshot(),
  staleTime: 30 * 60 * 1000,
  placeholderData: () => cachedCatalog.current ?? undefined,
});

// Persist fresh data
useEffect(() => {
  if (products) offlineCache.saveCatalog(products);
}, [products]);
```

The `syncQueue.ts` file's `openDB()` and `VERSION` constant must be updated to 3 and include the new stores in `onupgradeneeded`. The cleanest approach is to centralize the DB open logic in `offlineCache.ts` and import it from `syncQueue.ts` rather than duplicating.

### Statement Custom Date Range

`StatementView.tsx` currently has `FilterPreset = "zero" | "week" | "month" | "year"`. Extension:

1. Add `"custom"` to the `FilterPreset` union
2. When `preset === "custom"`, render a start/end `DatePicker` pair (existing UI component)
3. The existing query param logic already handles `start_date` / `end_date`; no backend change needed

### Statement PDF Export

Add a "Download PDF" button in `StatementView.tsx` that:
1. Calls `GET /customers/{id}/statement/pdf` with the current date range params
2. Receives the binary response as a Blob
3. Creates an object URL and triggers a download via `<a>` click

```typescript
async function handleDownloadPdf() {
  const blob = await salesApi.downloadStatementPdf(customer.id, queryParams);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `statement-${customer.name}-${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

PDF button is disabled with a tooltip when offline.

### New Sales Components

```
frontend/src/components/Sales/
├── ExpenseForm.tsx       NEW — form to log a field expense (category, amount, description, date, optional photo)
├── ExpensesView.tsx      NEW — list own expenses, grouped by date, with status badges
└── PurchaseFlow.tsx      NEW — reverse order flow (product picker, qty, purchase price per item)
```

`PurchaseFlow.tsx` reuses the product picker pattern from `OrderFlow.tsx`. Key differences:
- User sets a **purchase price** per item (defaults to existing `product.purchase_price`)
- WAC impact is shown as an info tooltip (frontend-estimated only; authoritative WAC computed server-side)
- Submitted via `salesApi.createPurchase()` or queued offline in `syncQueue` as type `"purchase"`

### New Admin Components

```
frontend/src/components/Admin/
└── DailyCashReport.tsx    NEW — date navigator (prev/next day), per-rep summary cards with confirm/flag
```

Shown in Admin shell as a new tab or page. Each card shows: rep name, total cash by currency, check count/total, expenses total, confirm/flag actions.

### Offline Queue Extension

Extend `QueueItem.type` from `"order" | "payment"` to `"order" | "payment" | "purchase"`. Add purchase flushing in `useOfflineSync.ts`:

```typescript
if (item.type === "purchase") {
  await salesApi.createPurchase(item.payload as PurchaseCreate);
}
```

---

## Data Flow

### Expense Submission (Sales Rep)

```
ExpenseForm (submit)
    ↓ [optional: upload receipt image first → POST /expenses/receipt-upload → get url]
salesApi.createExpense(payload)
    ↓
POST /expenses
    ↓
ExpenseService.create_expense()
    → writes Expense row (status: "pending", expense_date, created_by)
    ↓
React Query invalidate ["expenses", "my"]
    ↓
Admin sees expense in DailyCashReport summary for that day
```

### Daily Cash Report Generation and Confirmation

```
Admin opens DailyCashReport for date D, rep R
    ↓
adminApi.getDailyCashReport(date, repId)
    ↓
GET /admin/reports/daily-cash?date=D&rep_id=R
    ↓
AdminService.get_or_generate_report(date, rep_id)
    → SELECT transactions WHERE created_by=R AND date=D AND type IN [Payment_Cash, Payment_Check]
    → SELECT expenses WHERE created_by=R AND expense_date=D
    → aggregate by currency, count checks, sum expenses
    → UPSERT daily_cash_reports (on conflict update summary if status=pending)
    → return report
    ↓
Admin reviews summary card → clicks "Confirm"
    ↓
PUT /admin/reports/daily-cash/{id}/confirm
    → set confirmed_by, confirmed_at, status="confirmed"
    → confirmed report is immutable (upsert guard on status check)
```

### Purchase from Customer (WAC update)

```
PurchaseFlow (submit)
    ↓
[offline] → syncQueue.push("purchase", payload)
[online]  → salesApi.createPurchase(payload)
    ↓
POST /purchases
    ↓
PurchaseService.create_purchase() — single DB transaction:
    for each line_item:
        product = await session.get(Product, id, with_for_update=True)
        new_stock = product.stock_qty + qty
        new_wac = (product.stock_qty * product.purchase_price + qty * item_price) / new_stock
        product.stock_qty = new_stock
        product.purchase_price = new_wac
    total = sum(qty * item_price for each item)
    transaction = Transaction(type=Purchase, amount=-total, data=line_items_snapshot)
    customer.balance += -total   # reduces balance (negative amount)
    ↓
React Query invalidate ["products"], ["customer", id], ["statement", id]
```

### Offline Catalog Hydration

```
App boots (online)
    ↓
useQuery(["catalog"]) fires → salesApi.getOfflineSnapshot() → GET /products/offline-snapshot
    ↓ (cached in Redis 30min; returns full catalog)
onSuccess callback → offlineCache.saveCatalog(data) → writes to IndexedDB catalog_cache
    ↓
Next app boot (offline)
    ↓
useQuery(["catalog"]) fires → network fails
    ↓
placeholderData → offlineCache.loadCatalog() → reads from IndexedDB catalog_cache
    → products available for OrderFlow and PurchaseFlow
```

### Statement PDF Export

```
User taps "Download PDF" in StatementView
    ↓
[if offline] → show toast "PDF requires connection"; return
[if online]  →
salesApi.downloadStatementPdf(customerId, { start_date, end_date })
    ↓
GET /customers/{id}/statement/pdf?start_date=&end_date=
    ↓
StatementService.generate_pdf()
    → query transactions in range (same logic as existing statement endpoint)
    → render Jinja2 HTML template with Noto Arabic font
    → weasyprint.HTML(string=html).write_pdf()
    → return Response(content=pdf_bytes, media_type="application/pdf")
    ↓
Frontend: blob URL → anchor click → browser download dialog
```

---

## Recommended Project Structure Changes

```
backend/app/
├── api/endpoints/
│   ├── expenses.py          NEW — expense CRUD + admin confirmation
│   └── purchases.py         NEW — purchase-from-customer
│   └── admin.py             EXTEND — daily cash report endpoints
├── models/
│   ├── expense.py           NEW — Expense + ExpenseCategory
│   ├── daily_cash_report.py NEW — DailyCashReport
│   └── transaction.py       EXTEND — add Purchase to TransactionType enum
├── services/
│   ├── expense_service.py   NEW
│   ├── purchase_service.py  NEW — WAC logic, stock update, atomic transaction
│   └── admin_service.py     EXTEND — daily cash report generation/upsert
├── schemas/
│   ├── expense.py           NEW — ExpenseCreate, ExpenseOut
│   └── purchase.py          NEW — PurchaseCreate, PurchaseItemIn, PurchaseOut
└── repositories/
    └── expense_repository.py NEW

backend/alembic/versions/
    ├── XXXX_add_missing_transaction_indexes.py
    ├── XXXX_add_purchase_to_transactiontype.py
    ├── XXXX_add_expenses_table.py
    └── XXXX_add_daily_cash_reports_table.py

frontend/src/
├── components/
│   ├── Sales/
│   │   ├── ExpenseForm.tsx       NEW
│   │   ├── ExpensesView.tsx      NEW
│   │   └── PurchaseFlow.tsx      NEW
│   └── Admin/
│       └── DailyCashReport.tsx   NEW
├── lib/
│   └── offlineCache.ts           NEW — catalog + route IndexedDB cache (bumps DB to version 3)
└── services/
    ├── salesApi.ts               EXTEND — expense, purchase, PDF download, offline snapshot
    └── adminApi.ts               EXTEND — daily cash report endpoints
```

---

## Architectural Patterns

### Pattern 1: Atomic WAC Update with Row Lock

**What:** Wrap stock update + WAC recalculation + transaction insert in a single `async with session.begin()` block with `SELECT FOR UPDATE` on each product row.

**When to use:** Any operation where partial success leaves the system in an invalid state. A purchase that updates stock but fails to create the transaction record would corrupt inventory data.

**Trade-offs:** `SELECT FOR UPDATE` serializes concurrent purchases of the same product. At this scale (one business, <10 reps), contention is negligible. Do not use for read-heavy endpoints.

```python
async def create_purchase(self, body: PurchaseCreate, creator_id: uuid.UUID):
    async with self._session.begin():
        total = Decimal(0)
        line_items = []
        for item in body.items:
            product = await self._session.get(
                Product, item.product_id, with_for_update=True
            )
            if product is None:
                raise HorizonException(404, f"Product {item.product_id} not found")
            current_stock = product.stock_qty or 0
            current_price = product.purchase_price or item.price
            new_stock = current_stock + item.qty
            new_wac = (current_stock * current_price + item.qty * item.price) / new_stock
            product.stock_qty = new_stock
            product.purchase_price = new_wac
            item_total = item.qty * item.price
            total += item_total
            line_items.append({
                "product_id": str(item.product_id),
                "qty": item.qty,
                "price": str(item.price),
                "new_wac": str(new_wac),
            })
        txn = Transaction(
            customer_id=body.customer_id,
            created_by=creator_id,
            type=TransactionType.Purchase,
            amount=-total,
            currency=body.currency,
            data={"items": line_items},
        )
        self._session.add(txn)
        customer = await self._customers.get_by_id(body.customer_id)
        customer.balance += -total
```

### Pattern 2: JSONB Snapshot for Audit Records

**What:** When generating `DailyCashReport`, aggregate live data from transactions and expenses into a JSONB snapshot column. Once confirmed, the snapshot is immutable.

**When to use:** Admin-facing audit records that must remain stable even if source data changes. The JSONB snapshot captures reality at point of confirmation.

**Trade-offs:** Data duplication. Acceptable here because reports are audit artifacts, not the source of truth for balances. The upsert guard (`WHERE status = 'pending'`) prevents re-computing a confirmed report.

```python
async def get_or_generate_report(self, date: date, rep_id: uuid.UUID):
    existing = await self._repo.get_by_date_and_rep(date, rep_id)
    if existing and existing.status != "pending":
        return existing  # confirmed/flagged — return as-is

    # Aggregate fresh
    payments = await self._transaction_repo.get_payments_for_rep_on_date(rep_id, date)
    expenses = await self._expense_repo.get_expenses_for_rep_on_date(rep_id, date)
    summary = self._build_summary(payments, expenses)

    if existing:
        existing.summary = summary
        return await self._repo.update(existing)
    return await self._repo.create(DailyCashReport(
        report_date=date, sales_rep_id=rep_id, summary=summary
    ))
```

### Pattern 3: IndexedDB Version Bump for New Stores

**What:** Increment `VERSION` constant and register new stores in `onupgradeneeded`.

**When to use:** Required whenever new IndexedDB object stores are added. Browsers call `onupgradeneeded` only when the version number increases.

**Trade-offs:** All open tabs must close for the upgrade to proceed. The existing `onblocked` handler warns the user. This is a one-time event per user device.

```typescript
// lib/offlineCache.ts
const DB_NAME = "alofok_offline";
const VERSION = 3; // bumped from 2

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Existing stores from version 2 are preserved automatically
      if (!db.objectStoreNames.contains("catalog_cache")) {
        db.createObjectStore("catalog_cache", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("route_cache")) {
        db.createObjectStore("route_cache", { keyPath: "key" });
      }
    };
    req.onblocked = () => {
      console.warn("[offlineCache] IndexedDB upgrade blocked — close other tabs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

**Note:** `syncQueue.ts` must be updated to use the same `VERSION = 3` and `openDB()` — or better, both modules share a single `openDB()` from `offlineCache.ts`.

### Pattern 4: Offline Queue Type Extension for Purchases

**What:** Extend `QueueItem.type` union and add a flush branch in `useOfflineSync.ts`.

**When to use:** Any Sales Rep mutation that must survive offline.

**Trade-offs:** Purchases modify stock and WAC server-side. Queued purchases flush sequentially (existing behaviour) so WAC calculations are always sequential. Stock conflict between a queued purchase and concurrent in-flight orders is out of scope for v1.2.

```typescript
// lib/syncQueue.ts
export interface QueueItem {
  id?: number;
  type: "order" | "payment" | "purchase";  // "purchase" added
  payload: unknown;
  created_at: string;
}

// hooks/useOfflineSync.ts — add branch in flush()
if (item.type === "purchase") {
  await salesApi.createPurchase(item.payload as PurchaseCreate);
}
```

### Pattern 5: Server-Side PDF with weasyprint

**What:** Backend endpoint generates PDF from a Jinja2 HTML template, rendered by `weasyprint`. Returns binary `application/pdf` response.

**When to use:** Arabic RTL text in PDFs. `weasyprint` uses CSS for layout and respects `direction: rtl` — the same CSS skills used throughout the app. `reportlab` requires separate Arabic reshaping libraries and is harder to style.

**Trade-offs:** `weasyprint` requires system packages in the Docker image (`libpango`, fonts). Adds ~80MB to the Docker image. Acceptable for a self-hosted single-business app.

```dockerfile
# backend/Dockerfile addition
RUN apt-get install -y \
    fonts-noto-core \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info
```

```python
# backend/services/statement_service.py (extend existing)
from weasyprint import HTML

async def generate_statement_pdf(
    self, customer_id: uuid.UUID, start_date: date, end_date: date
) -> bytes:
    transactions = await self._transactions.get_statement(customer_id, start_date, end_date)
    html_content = render_template("statement.html", transactions=transactions, ...)
    return HTML(string=html_content).write_pdf()
```

---

## Integration Points

### New vs Modified: Complete Matrix

| Component | Status | What Changes |
|-----------|--------|--------------|
| `models/expense.py` | NEW | Expense model + ExpenseCategory enum |
| `models/daily_cash_report.py` | NEW | DailyCashReport model with UniqueConstraint |
| `models/transaction.py` | MODIFIED | Add `Purchase` to `TransactionType` enum |
| `schemas/expense.py` | NEW | ExpenseCreate, ExpenseOut Pydantic models |
| `schemas/purchase.py` | NEW | PurchaseCreate, PurchaseItemIn, PurchaseOut |
| `services/expense_service.py` | NEW | create, list, confirm, reject |
| `services/purchase_service.py` | NEW | create_purchase with WAC + atomic transaction |
| `services/admin_service.py` | MODIFIED | Add report generation, confirmation, flagging |
| `api/endpoints/expenses.py` | NEW | Sales + admin expense endpoints |
| `api/endpoints/purchases.py` | NEW | POST /purchases |
| `api/endpoints/admin.py` | MODIFIED | Daily cash report endpoints |
| `api/endpoints/products.py` | MODIFIED | Add GET /products/offline-snapshot |
| `api/endpoints/customers.py` | MODIFIED | Add GET /customers/{id}/statement/pdf |
| `repositories/expense_repository.py` | NEW | CRUD + filtered list queries |
| `Dockerfile` | MODIFIED | Add weasyprint system deps + Noto fonts |
| Alembic migrations | NEW (4 files) | indexes, Purchase enum, expenses table, daily_cash_reports table |
| `lib/offlineCache.ts` | NEW | IndexedDB version 3, catalog_cache + route_cache stores |
| `lib/syncQueue.ts` | MODIFIED | Version bump to 3 (share openDB with offlineCache), add "purchase" type |
| `hooks/useOfflineSync.ts` | MODIFIED | Add purchase flush branch |
| `services/salesApi.ts` | MODIFIED | Add createExpense, createPurchase, getOfflineSnapshot, downloadStatementPdf |
| `services/adminApi.ts` | MODIFIED | Add daily cash report CRUD |
| `components/Sales/ExpenseForm.tsx` | NEW | Log field expense |
| `components/Sales/ExpensesView.tsx` | NEW | List own expenses |
| `components/Sales/PurchaseFlow.tsx` | NEW | Reverse order flow |
| `components/Sales/StatementView.tsx` | MODIFIED | Add custom date preset + PDF download button |
| `components/Admin/DailyCashReport.tsx` | NEW | Daily cash reconciliation UI |
| `locales/en.json` + `ar.json` | MODIFIED | New keys for all new features |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| ExpenseService ↔ TransactionRepo | None — no shared state | Expenses are fully independent of transaction balance logic |
| PurchaseService ↔ ProductModel | Direct async SA write with row lock | No cache invalidation in service — endpoint handles React Query invalidation signal |
| PurchaseService ↔ CustomerRepo | Shared — updates `customer.balance` | Same repo.update() pattern as OrderService |
| AdminService ↔ ExpenseRepo | Read-only — includes expenses in daily cash summary | One-way dependency: admin service reads expenses but does not write them |
| offlineCache ↔ syncQueue | Same IndexedDB database, different stores | Must share VERSION constant and coordinate `onupgradeneeded` |
| StatementService ↔ weasyprint | In-process library call | PDF rendered synchronously in the endpoint; acceptable at low volume |

---

## Build Order (Dependency Graph)

Dependencies run top to bottom. Independent tracks can be parallelized.

```
Track A (DB foundation — must ship first, unblocks everything)
    1. Alembic: add missing transaction indexes      (no code change, immediate perf win)
    2. Alembic: add Purchase to TransactionType enum (unblocks purchase service)
    3. Alembic: add expenses table                   (unblocks expense endpoints)
    4. Alembic: add daily_cash_reports table         (unblocks cash report endpoints)

Track B (Expense feature — after step 3)
    5. Expense model + schemas
    6. ExpenseService + ExpenseRepository
    7. expense.py endpoints (Sales + Admin)
    8. Sales: ExpenseForm.tsx + ExpensesView.tsx
    9. Admin: DailyCashReport.tsx (reads expenses as part of summary)

Track C (Purchase feature — after step 2)
    10. PurchaseService (WAC logic)
    11. purchases.py endpoint
    12. Extend syncQueue.ts + useOfflineSync.ts for "purchase" type
    13. Sales: PurchaseFlow.tsx

Track D (Offline caching — independent of B and C)
    14. products.py: GET /products/offline-snapshot
    15. offlineCache.ts (IndexedDB version 3, new stores)
    16. Integrate placeholderData in catalog/route queries

Track E (Statement enhancements — independent of all tracks)
    17. StatementView.tsx: add custom date preset (no backend change)
    18. Dockerfile: weasyprint system deps + Noto fonts
    19. StatementService: generate_pdf()
    20. customers.py: GET /customers/{id}/statement/pdf
    21. StatementView.tsx: PDF download button

Track F (Daily cash report — after B + step 1)
    22. AdminService extension: report generation + confirmation
    23. admin.py: daily cash report endpoints
    24. Admin: DailyCashReport.tsx (depends on B step 9 if expense totals are included)
```

Suggested sprint order if one developer: A → B (5-9) → C (10-13) → D (14-16) → E (17-21) → F (22-24). Tracks B and C can be parallelized by two developers after Track A ships.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding Expenses to the Transactions Table

**What people do:** Add `type=Expense` to `TransactionType`, reuse the transactions table.

**Why it's wrong:** `transactions.customer_id` is NOT NULL. Expenses have no customer. All balance calculations (`SELECT SUM(amount) FROM transactions WHERE customer_id = X`) would need `WHERE type != 'Expense'` guards added everywhere — a pervasive correctness risk.

**Do this instead:** Separate `expenses` table with its own model, service, and endpoints.

### Anti-Pattern 2: Client-Side WAC Calculation

**What people do:** Compute WAC in the frontend and display it as the result, trusting the frontend calculation.

**Why it's wrong:** If two reps submit purchases of the same product concurrently, both read the same `stock_qty` before either updates it. The result is two incorrect WAC values being written. WAC must be calculated with `SELECT FOR UPDATE` server-side.

**Do this instead:** Show a WAC preview in the UI (estimated, clearly labelled), but authoritative WAC is always written by the backend inside a locked transaction.

### Anti-Pattern 3: Not Versioning the IndexedDB Schema

**What people do:** Add new object stores without incrementing the database version.

**Why it's wrong:** Browsers only call `onupgradeneeded` when the version number increases. Without a bump, the new stores are never created; `offlineCache.saveCatalog()` throws `DOMException: The specified object store was not found`.

**Do this instead:** Every time a new IndexedDB store is added, increment `VERSION` and handle creation in `onupgradeneeded`. The existing `onblocked` handler already addresses the "close other tabs" UX.

### Anti-Pattern 4: Client-Side PDF Generation

**What people do:** Use `jsPDF` or `html2canvas` to generate the statement PDF in the browser.

**Why it's wrong:** Arabic RTL text shaping in `jsPDF` is unreliable without significant extra work. `html2canvas` captures visual output (not print-quality). Both approaches produce inconsistent results across devices and browsers.

**Do this instead:** `weasyprint` server-side with the Noto Arabic font. The HTML template uses the same CSS RTL layout as the app. Output is consistent and printable.

### Anti-Pattern 5: Pagination on the Offline Snapshot Endpoint

**What people do:** Reuse the paginated catalog endpoint for offline hydration, fetching page by page.

**Why it's wrong:** Offline hydration requires the complete catalog in a single IndexedDB write. Multiple paginated requests introduce partial failure risk — if page 3 fails, the catalog is incomplete. The Sales Rep then sees truncated product lists offline.

**Do this instead:** Dedicated `GET /products/offline-snapshot` that returns the full catalog in one request. Cache it in Redis at a longer TTL (30 min). Size is bounded by the catalog size (~200-500 products for a painting tools business — well within HTTP response limits).

---

## Scaling Considerations

| Scale | Considerations |
|-------|---------------|
| Current (1 business, <10 reps) | All patterns above are appropriate. Monolith is correct. |
| 10-50 businesses | Add `tenant_id` to expenses and daily_cash_reports. Partition transactions table if it exceeds 10M rows. |
| 50+ businesses | Separate read replicas for reporting (daily cash, statement PDF). Offload PDF generation to a background task queue (Celery/ARQ) if response times exceed 5s. |

First bottleneck at current scale: the `transactions` table growing without indexes. This is why the index migration is build step 1 — it must ship before the rest of v1.2.

Second bottleneck: weasyprint PDF generation is synchronous and may block a FastAPI worker for 0.5-2s per request. Acceptable at current volume (<5 PDFs/day). Use `asyncio.to_thread(HTML(...).write_pdf)` to avoid blocking the event loop.

---

## Sources

- Direct inspection: `backend/app/models/transaction.py`, `product.py`
- Direct inspection: `backend/app/api/endpoints/admin.py`, `payments.py`
- Direct inspection: `backend/app/services/order_service.py` (WAC pattern template)
- Direct inspection: `frontend/src/lib/syncQueue.ts`, `hooks/useOfflineSync.ts`
- Direct inspection: `frontend/src/components/Sales/StatementView.tsx`
- Project context: `.planning/PROJECT.md`
- weasyprint Arabic RTL: MEDIUM confidence — CSS-based layout, works with system Noto fonts; tested pattern in Python PDF generation community
- `SELECT FOR UPDATE` with async SQLAlchemy: HIGH confidence — standard SQLAlchemy pattern, `with_for_update=True` on `session.get()`
- IndexedDB version upgrade behaviour: HIGH confidence — MDN Web Docs specification

---

*Architecture research for: Alofok v1.2 Business Operations*
*Researched: 2026-03-05*
