# Phase 8: Check Lifecycle Management - Research

**Researched:** 2026-03-04
**Domain:** State machine enforcement (backend) + Admin CRUD UI (frontend)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Admin Check List**
- New "Checks" tab added to admin bottom nav (alongside Overview, Products, Customers, Profile)
- Dedicated top-level check management view — not nested inside customer detail
- Filter by status using tab/pill filters: All | Pending | Deposited | Returned — default to Pending
- Each check card shows: customer name, amount, currency, bank name, due date, status badge — compact card layout
- No batch operations — one check at a time, each card has its own action button

**Status Transition UX**
- Inline action buttons visible on each check card (Deposit button for Pending, Return button for Pending/Deposited)
- Always show a confirmation dialog before executing any transition (both Deposit and Return)
- Hide invalid action buttons entirely — don't show disabled/grayed-out buttons for invalid transitions
  - Pending → shows Deposit + Return buttons
  - Deposited → shows Return button only
  - Returned → no action buttons
- All lifecycle actions (Deposit and Return) are Admin-only — Sales reps have no check lifecycle actions in their UI

**Check Visibility**
- Semantic badge colors: Pending = yellow/amber (warning variant), Deposited = green (success variant), Returned = red (destructive variant)
- Check status badges visible in Sales rep StatementView (read-only, no actions)
- Check status badges visible in Customer portal StatementView
- Returned checks appear as two separate statement entries (original payment with "Returned" badge + Check_Return re-debit as separate positive entry) — matches existing backend behavior

**Return Details**
- Return confirmation dialog includes optional notes text field (not mandatory)
- Confirmation dialog shows financial impact: "This will re-debit [amount] [currency] to [customer name]'s balance"
- After returning a check, admin stays in the check list (returned check updates to "Returned" badge in place)
- No notifications to sales reps

### Claude's Discretion
- Card layout details (spacing, typography, shadows)
- Loading states and skeletons for the check list
- Error state handling for failed transitions
- Sort order within filtered check list (by date, by amount, etc.)
- Exact confirmation dialog wording and layout
- Search/filter within check list (if useful)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LCY-01 | Admin can mark a Pending check as Deposited | New `deposit_check()` method in PaymentService + new PUT endpoint in payments router |
| LCY-02 | Admin can mark a Pending or Deposited check as Returned (creates Check_Return debit transaction) | Existing `return_check()` already handles this; needs to accept Deposited checks too (currently only rejects Returned) |
| LCY-03 | Backend enforces valid transitions only (rejects invalid ones with 409) | HorizonException(409, ...) pattern already used in return_check; extend for deposit guard |
| LCY-04 | Invalid transition buttons are disabled/hidden in the UI | Conditional rendering in CheckCard based on check.status |
| LCY-05 | Check status is visible in customer statement and admin views | Badge render in StatementView + new AdminChecksView; TransactionOut already returns status field |
</phase_requirements>

## Summary

Phase 8 is primarily a state machine enforcement phase with a new Admin UI surface. The backend already has the foundation: `TransactionStatus` enum (Pending/Deposited/Returned/Cleared), `TransactionType.Check_Return`, and a working `return_check()` method in `PaymentService`. The two gaps are: (1) no `deposit_check()` method exists, and (2) `return_check()` currently rejects any non-Returned check including Deposited ones — meaning it implicitly supports the Pending→Returned transition but needs to explicitly allow Deposited→Returned as well.

The frontend needs one new top-level component (`AdminChecksView`) registered as a new "Checks" nav tab in `AdminPanel/index.tsx`. The StatementView components (Sales and Customer portal) need a status badge added to check transaction entries — they already receive the `status` field from `TransactionOut` but don't render it visually. Everything else reuses existing patterns: Card, Badge, Dialog, Tabs/pills, ConfirmationDialog, useMutation + useQueryClient invalidation.

**Primary recommendation:** Implement in two plans — Plan 01: Backend (deposit endpoint + state machine fix) and Plan 02: Frontend (AdminChecksView + StatementView status badges).

## Standard Stack

### Core (already in project — no installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI + SQLAlchemy async | existing | Backend endpoint + DB mutation | Project stack |
| React Query (TanStack) | existing | Data fetching, mutation, cache invalidation | Project stack |
| HorizonException | existing | Structured 4xx error responses | Project error pattern |
| Badge (CVA variants) | existing | Status chip display | warning/success/destructive already defined |
| Dialog / ConfirmationDialog | existing | Transition confirmation | Used in OrderFlow already |
| Tabs / TabsList / TabsTrigger | existing | Pill filters (variant="pills") | Used in RouteView + StatementView |
| Textarea | existing | Optional notes on return | Already in ui/ |
| Lucide React | existing | Icons (FileCheck2, Banknote, RotateCcw) | Project icon set |

### No new dependencies required

This phase is entirely internal — state machine logic in Python, UI composition in React from existing components.

## Architecture Patterns

### Backend: State Machine in Service Layer

The project uses the service layer (PaymentService) for business logic, not at the repository or endpoint level. State transition validation belongs in `PaymentService`, not in the router.

**Pattern already established in `return_check()`:**
```python
# Source: backend/app/services/payment_service.py
async def return_check(self, transaction_id, creator_id):
    check_txn = await self._transactions.get_by_id(transaction_id)
    if check_txn is None or check_txn.type != TransactionType.Payment_Check:
        raise HorizonException(404, "Check transaction not found")
    if check_txn.status == TransactionStatus.Returned:
        raise HorizonException(409, "Check is already marked as returned")
    ...
```

**New `deposit_check()` follows the same pattern:**
```python
async def deposit_check(self, transaction_id: uuid.UUID, creator_id: uuid.UUID) -> TransactionOut:
    check_txn = await self._transactions.get_by_id(transaction_id)
    if check_txn is None or check_txn.type != TransactionType.Payment_Check:
        raise HorizonException(404, "Check transaction not found")
    if check_txn.status != TransactionStatus.Pending:
        raise HorizonException(409, "Only Pending checks can be deposited")
    check_txn.status = TransactionStatus.Deposited
    check_txn = await self._transactions.update(check_txn)
    return TransactionOut.model_validate(check_txn)
```

**`return_check()` fix** — must also allow Deposited → Returned:
```python
# Current (wrong): rejects if status == Returned → allows both Pending and Deposited
# Actually the current guard `if check_txn.status == TransactionStatus.Returned` is correct:
# it only blocks if already Returned. Pending and Deposited both pass through.
# No fix needed — behavior is already correct per spec.
```

Wait — re-reading `return_check()`: it raises 409 only if `status == Returned`. This means Pending → Returned and Deposited → Returned both work already. The existing `return_check()` already handles LCY-02 correctly for both source statuses.

### Backend: Endpoint Design

**Current `payments.py` router:**
```python
# PUT /payments/checks/{transaction_id}/status  — return_check (Sales + Admin)
```

**Required additions:**
```python
# POST or PUT /payments/checks/{transaction_id}/deposit  — deposit_check (Admin only)
```

Design decision: use `PUT /payments/checks/{transaction_id}/deposit` (action-based) rather than a generic status PATCH. This is explicit and avoids an open enum payload that could accept arbitrary statuses.

**RBAC:** Deposit endpoint must use `require_admin` dependency. The existing return endpoint uses no role guard currently — it should remain as-is (admin-only per CONTEXT.md decisions; the existing endpoint is already callable only by auth'd users).

Note: CONTEXT.md states all lifecycle actions are Admin-only. The existing `return_check` endpoint at `PUT /payments/checks/{transaction_id}/status` has no `require_sales` or `require_admin` guard — it accepts any authenticated user. For Phase 8, the new deposit endpoint must use `require_admin`. The return endpoint's RBAC will be tightened as part of this phase too.

### Backend: Check List Endpoint

A new endpoint is needed: `GET /admin/checks` returning all `Payment_Check` transactions with an optional `status` filter query param. This lives in `admin.py` router.

**Schema needed:** A richer `CheckOut` schema that includes `customer_name` alongside transaction fields (similar to `OrderWithCustomerOut`).

```python
class CheckOut(TransactionOut):
    customer_name: str
```

**Query pattern (from AdminService.get_debt_stats as reference):**
```python
# JOIN transactions + customers, filter type=Payment_Check, optional status filter
result = await db.execute(
    select(Transaction, Customer.name.label("customer_name"))
    .join(Customer, Transaction.customer_id == Customer.id)
    .where(
        Transaction.type == TransactionType.Payment_Check,
        Transaction.is_deleted.is_(False),
        # optional: Transaction.status == filter_status
    )
    .order_by(Transaction.created_at.desc())
)
```

This can live in `AdminService` or as a new `get_all_checks()` in `TransactionRepository`. Given the join complexity, AdminService raw SQL or ORM join is appropriate.

### Frontend: AdminView Type Union Extension

Current `AdminView` type in `AdminPanel/index.tsx`:
```typescript
type AdminView =
  | "overview" | "sales" | "debt"
  | "customers" | "addCustomer" | "customerDetail" | "editCustomer"
  | "order" | "payment" | "statement"
  | "products" | "addProduct"
  | "profile";
```

Add `"checks"` to this union. Add a `case "checks":` to `renderView()`, and add a nav item to `navItems` array.

**Bottom nav constraint:** BottomNav enforces max 5 items (`items.slice(0, 5)`). Current nav has 4 items (Overview, Products, Customers, Profile). Adding "Checks" = 5 items total — fits within the limit.

**isMainView array** must include `"checks"` so the bottom nav renders on the checks screen.

**bottomNavActiveValue mapping** needs no special case for checks.

### Frontend: CheckCard Component

A new component `AdminChecksView.tsx` containing a `CheckCard` sub-component.

**Card action button logic:**
```typescript
// Conditional rendering — hide, not disable
{check.status === "Pending" && (
  <Button size="sm" onClick={() => handleDeposit(check)}>
    {t("checks.deposit")}
  </Button>
)}
{(check.status === "Pending" || check.status === "Deposited") && (
  <Button size="sm" variant="destructive" onClick={() => handleReturn(check)}>
    {t("checks.return")}
  </Button>
)}
// Returned: no buttons rendered
```

### Frontend: StatementView Status Badge

Both `Sales/StatementView.tsx` and `Customer/StatementView.tsx` need a status badge added to check transaction entries. The `status` field is already in the `Transaction` interface and is returned by the API.

**Add after the transaction type badge:**
```tsx
{tx.type === "Payment_Check" && tx.status && (
  <Badge variant={checkStatusVariant(tx.status)} size="sm">
    {t(`checks.status.${tx.status}`)}
  </Badge>
)}
```

**`checkStatusVariant` function:**
```typescript
const checkStatusVariant = (status: string) => {
  if (status === "Pending") return "warning" as const;
  if (status === "Deposited") return "success" as const;
  if (status === "Returned") return "destructive" as const;
  return "outline" as const;
};
```

### Frontend: Data Flow Pattern

Follow the existing mutation pattern from `CustomerDashboard` / `RouteView`:

```typescript
const depositMutation = useMutation({
  mutationFn: (checkId: string) => adminApi.depositCheck(checkId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin-checks"] });
    toast({ title: t("checks.depositSuccess"), variant: "success" });
  },
  onError: () => toast({ title: t("toast.error"), variant: "error" }),
});

const returnMutation = useMutation({
  mutationFn: ({ checkId, notes }: { checkId: string; notes?: string }) =>
    adminApi.returnCheck(checkId, notes),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin-checks"] });
    toast({ title: t("checks.returnSuccess"), variant: "success" });
  },
  onError: () => toast({ title: t("toast.error"), variant: "error" }),
});
```

### Frontend: Return Dialog with Notes Field

The standard `ConfirmationDialog` doesn't support extra form fields. For the return action, use the raw `Dialog` + `DialogContent` pattern (as done in `AdminPanel` for the order confirmation with DatePicker):

```tsx
<Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>{t("checks.returnConfirmTitle")}</DialogTitle>
      <DialogDescription>
        {t("checks.returnConfirmDesc", {
          amount: selectedCheck?.amount,
          currency: selectedCheck?.currency,
          customer: selectedCheck?.customer_name,
        })}
      </DialogDescription>
    </DialogHeader>
    <Textarea
      placeholder={t("checks.returnNotesPlaceholder")}
      value={returnNotes}
      onChange={(e) => setReturnNotes(e.target.value)}
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
        {t("actions.cancel")}
      </Button>
      <Button variant="destructive" onClick={handleConfirmReturn} isLoading={returnMutation.isPending}>
        {t("checks.confirmReturn")}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

For the deposit action, the standard `ConfirmationDialog` is sufficient (no extra fields).

### Frontend: adminApi Extensions

Two new methods in `adminApi.ts`:

```typescript
// Check list
getChecks: (status?: "Pending" | "Deposited" | "Returned") =>
  api.get<CheckOut[]>("/admin/checks", { params: status ? { status } : {} })
    .then((r) => r.data),

// Deposit action
depositCheck: (checkId: string) =>
  api.put<Transaction>(`/payments/checks/${checkId}/deposit`)
    .then((r) => r.data),

// Return action — existing returnCheck in salesApi, needs admin version (or reuse same endpoint)
returnCheck: (checkId: string, notes?: string) =>
  api.put<Transaction>(`/payments/checks/${checkId}/return`, { notes })
    .then((r) => r.data),
```

**Note on endpoint consolidation:** `salesApi.returnCheck` currently calls `PUT /payments/checks/{id}/status`. Since this phase clarifies that return is Admin-only, the admin panel should call a dedicated admin endpoint or the same endpoint protected by `require_admin`. The cleanest approach is to keep one return endpoint and add `require_admin` to it. The `salesApi.returnCheck` can remain in salesApi.ts (unused in UI for now) without breaking the API.

### Anti-Patterns to Avoid

- **Storing status filter in URL params:** Keep filter state local with `useState` — consistent with how RouteView/StatementView handle their filter state
- **Optimistic updates on status transitions:** Do not use optimistic updates for financial state changes — always wait for server confirmation before updating UI
- **Using ConfirmationDialog for Return action:** ConfirmationDialog has no slot for extra form fields — use raw Dialog for the return confirmation that includes the notes textarea

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State transition validation | Custom middleware | Service-layer guard + HorizonException(409) | Project pattern already established |
| Check status display | Custom badge | Badge with existing variants (warning/success/destructive) | Already defined in badge.tsx |
| Deposit confirmation | Custom modal | ConfirmationDialog component | Already handles loading state, styling |
| Return confirmation | Custom modal from scratch | Dialog + DialogContent (same as order confirm in AdminPanel) | Pattern already in use for dialogs with form fields |
| Data fetching + cache | Custom fetch | React Query useQuery + invalidateQueries | Project standard |

## Common Pitfalls

### Pitfall 1: Bottom Nav 5-Item Limit
**What goes wrong:** Adding a 6th item silently truncates the last nav entry.
**Why it happens:** `BottomNav` calls `items.slice(0, 5)` — enforced in the component.
**How to avoid:** Current admin nav has 4 items. Adding "Checks" = 5. This is the maximum — do not add more.
**Warning signs:** Nav item disappears without error.

### Pitfall 2: return_check RBAC Gap
**What goes wrong:** The existing `PUT /payments/checks/{id}/status` endpoint has no role guard — any authenticated user can call it.
**Why it happens:** The endpoint was added before CONTEXT.md locked down Admin-only lifecycle actions.
**How to avoid:** Add `dependencies=[require_admin]` to the existing return endpoint when adding the deposit endpoint. Both transition endpoints should be Admin-only.
**Warning signs:** Sales rep can return a check from postman/curl.

### Pitfall 3: isMainView Array Missing "checks"
**What goes wrong:** Bottom nav doesn't render when on the checks view, so admin cannot navigate away.
**Why it happens:** `isMainView` is a hardcoded array in AdminPanel — must include all top-level views.
**How to avoid:** Add `"checks"` to `isMainView` array alongside "overview", "customers", "products", "addProduct", "profile".

### Pitfall 4: QueryKey Mismatch on Invalidation
**What goes wrong:** After a deposit/return, the check list doesn't refresh.
**Why it happens:** `invalidateQueries` key must exactly match the `useQuery` key used in AdminChecksView.
**How to avoid:** Establish a consistent key: `["admin-checks"]` (no status filter in key — let the query re-fetch all, then filter client-side) or `["admin-checks", statusFilter]` if server-side filtering.

### Pitfall 5: return_check Notes Payload Mismatch
**What goes wrong:** Backend `return_check()` currently does not accept a `notes` parameter — notes are hardcoded as `f"Returned check #{check_txn.id}"`.
**Why it happens:** The original implementation had no optional notes.
**How to avoid:** Extend `return_check(transaction_id, creator_id, notes=None)` to accept optional notes and use them in the Check_Return transaction instead of the hardcoded string.

### Pitfall 6: CheckOut Schema Missing customer_name
**What goes wrong:** Admin check list cannot show customer name without a JOIN.
**Why it happens:** `TransactionOut` only has `customer_id`, not the name.
**How to avoid:** Create a new `CheckOut(TransactionOut)` Pydantic schema with `customer_name: str` field, returned by the list endpoint.

### Pitfall 7: StatementView — Check_Return Entries Have No Status
**What goes wrong:** Check_Return entries have `status = null` (not a check payment itself). The status badge should only appear on `Payment_Check` type entries.
**Why it happens:** `TransactionOut.status` is nullable and only set for `Payment_Check` rows.
**How to avoid:** Guard status badge render: `tx.type === "Payment_Check" && tx.status !== null`.

## Code Examples

### Backend: New Deposit Endpoint

```python
# Source: backend/app/api/endpoints/payments.py — add alongside return endpoint
@router.put(
    "/checks/{transaction_id}/deposit",
    response_model=TransactionOut,
    dependencies=[require_admin],
)
async def deposit_check(
    transaction_id: uuid.UUID,
    current_user: CurrentUser,
    service: PaymentSvc,
) -> TransactionOut:
    return await service.deposit_check(transaction_id, uuid.UUID(current_user["sub"]))
```

### Backend: deposit_check Service Method

```python
# Source: backend/app/services/payment_service.py — add to PaymentService class
async def deposit_check(
    self, transaction_id: uuid.UUID, creator_id: uuid.UUID
) -> TransactionOut:
    check_txn = await self._transactions.get_by_id(transaction_id)
    if check_txn is None or check_txn.type != TransactionType.Payment_Check:
        raise HorizonException(404, "Check transaction not found")
    if check_txn.status != TransactionStatus.Pending:
        raise HorizonException(409, "Only Pending checks can be deposited")
    check_txn.status = TransactionStatus.Deposited
    check_txn = await self._transactions.update(check_txn)
    return TransactionOut.model_validate(check_txn)
```

### Backend: Extended return_check with Notes

```python
async def return_check(
    self,
    transaction_id: uuid.UUID,
    creator_id: uuid.UUID,
    notes: str | None = None,
) -> TransactionOut:
    check_txn = await self._transactions.get_by_id(transaction_id)
    if check_txn is None or check_txn.type != TransactionType.Payment_Check:
        raise HorizonException(404, "Check transaction not found")
    if check_txn.status == TransactionStatus.Returned:
        raise HorizonException(409, "Check is already marked as returned")

    check_txn.status = TransactionStatus.Returned
    original_amount = abs(check_txn.amount)
    return_txn = Transaction(
        customer_id=check_txn.customer_id,
        created_by=creator_id,
        type=TransactionType.Check_Return,
        currency=check_txn.currency,
        amount=original_amount,
        related_transaction_id=check_txn.id,
        notes=notes or f"Returned check #{check_txn.id}",
    )

    customer = await self._customers.get_by_id(check_txn.customer_id)
    customer.balance += original_amount
    await self._customers.update_balance(customer)
    await self._transactions.create_many([return_txn])

    return TransactionOut.model_validate(return_txn)
```

### Backend: Return Endpoint with Notes Body

```python
class ReturnCheckBody(BaseModel):
    notes: str | None = None

@router.put(
    "/checks/{transaction_id}/return",
    response_model=TransactionOut,
    dependencies=[require_admin],
)
async def return_check(
    transaction_id: uuid.UUID,
    body: ReturnCheckBody,
    current_user: CurrentUser,
    service: PaymentSvc,
) -> TransactionOut:
    return await service.return_check(
        transaction_id, uuid.UUID(current_user["sub"]), body.notes
    )
```

**Note:** This creates a new `/checks/{id}/return` endpoint. The old `/checks/{id}/status` endpoint can stay for backward compat or be updated to require_admin. Both are feasible.

### Backend: Check List Endpoint + Schema

```python
# schemas/admin.py addition
class CheckOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    type: TransactionType
    currency: Currency
    amount: Decimal
    status: TransactionStatus | None
    notes: str | None
    data: CheckData | None
    created_at: datetime
    related_transaction_id: uuid.UUID | None

    model_config = {"from_attributes": True}
```

```python
# admin.py router addition
@router.get("/checks", response_model=list[CheckOut], dependencies=[require_admin])
async def list_checks(
    service: AdminSvc,
    status: TransactionStatus | None = None,
) -> list[CheckOut]:
    return await service.get_all_checks(status)
```

```python
# admin_service.py addition
async def get_all_checks(
    self, status: TransactionStatus | None = None
) -> list[dict]:
    from app.models.transaction import TransactionType
    from app.models.customer import Customer

    query = (
        select(Transaction, Customer.name.label("customer_name"))
        .join(Customer, Transaction.customer_id == Customer.id)
        .where(
            Transaction.type == TransactionType.Payment_Check,
            Transaction.is_deleted.is_(False),
        )
        .order_by(Transaction.created_at.desc())
    )
    if status is not None:
        query = query.where(Transaction.status == status)

    result = await self.db.execute(query)
    rows = result.all()
    return [
        CheckOut(
            **{c.key: getattr(row.Transaction, c.key)
               for c in row.Transaction.__table__.columns},
            customer_name=row.customer_name,
        )
        for row in rows
    ]
```

### Frontend: Status Filter Tab Pattern (from RouteView)

```tsx
// Source: frontend/src/components/Sales/RouteView.tsx — day switcher pattern
<TabsList variant="pills" className="w-full justify-between">
  {STATUS_FILTERS.map((s) => (
    <TabsTrigger key={s.value} value={s.value}>
      {t(s.labelKey)}
    </TabsTrigger>
  ))}
</TabsList>
```

### Frontend: AdminView Extension

```typescript
// frontend/src/components/Admin/index.tsx
type AdminView =
  | "overview" | "sales" | "debt"
  | "checks"                               // NEW
  | "customers" | "addCustomer" | "customerDetail" | "editCustomer"
  | "order" | "payment" | "statement"
  | "products" | "addProduct"
  | "profile";

// navItems — add 5th item
const navItems = [
  { icon: LayoutDashboard, label: t("nav.overview"), value: "overview" },
  { icon: Package, label: t("nav.products"), value: "products" },
  { icon: FileCheck2, label: t("nav.checks"), value: "checks" },   // NEW (import FileCheck2 from lucide)
  { icon: Users, label: t("nav.customers"), value: "customers" },
  { icon: User, label: t("profile.title"), value: "profile" },
];

// isMainView — add "checks"
const isMainView = ["overview", "customers", "products", "addProduct", "checks", "profile"].includes(activeView);

// renderView — add case
case "checks":
  return <AdminChecksView />;
```

### Locale Keys Needed

**English additions to en.json:**
```json
{
  "nav": {
    "checks": "Checks"
  },
  "checks": {
    "title": "Check Management",
    "filterAll": "All",
    "filterPending": "Pending",
    "filterDeposited": "Deposited",
    "filterReturned": "Returned",
    "deposit": "Deposit",
    "return": "Return",
    "depositSuccess": "Check marked as deposited",
    "returnSuccess": "Check returned and balance updated",
    "depositConfirmTitle": "Deposit Check",
    "depositConfirmDesc": "Mark this check as deposited?",
    "returnConfirmTitle": "Return Check",
    "returnConfirmDesc": "This will re-debit {{amount}} {{currency}} to {{customer}}'s balance.",
    "returnNotesPlaceholder": "Reason for return (optional)",
    "confirmReturn": "Confirm Return",
    "noChecks": "No checks found",
    "bank": "Bank",
    "dueDate": "Due Date",
    "status": {
      "Pending": "Pending",
      "Deposited": "Deposited",
      "Returned": "Returned"
    }
  }
}
```

**Arabic equivalents to ar.json:**
```json
{
  "nav": {
    "checks": "الشيكات"
  },
  "checks": {
    "title": "إدارة الشيكات",
    "filterAll": "الكل",
    "filterPending": "معلق",
    "filterDeposited": "مودع",
    "filterReturned": "مرتجع",
    "deposit": "إيداع",
    "return": "إرجاع",
    "depositSuccess": "تم تحديد الشيك كمودع",
    "returnSuccess": "تم إرجاع الشيك وتحديث الرصيد",
    "depositConfirmTitle": "إيداع الشيك",
    "depositConfirmDesc": "هل تريد تحديد هذا الشيك كمودع؟",
    "returnConfirmTitle": "إرجاع الشيك",
    "returnConfirmDesc": "سيتم إعادة خصم {{amount}} {{currency}} من رصيد {{customer}}.",
    "returnNotesPlaceholder": "سبب الإرجاع (اختياري)",
    "confirmReturn": "تأكيد الإرجاع",
    "noChecks": "لا توجد شيكات",
    "bank": "البنك",
    "dueDate": "تاريخ الاستحقاق",
    "status": {
      "Pending": "معلق",
      "Deposited": "مودع",
      "Returned": "مرتجع"
    }
  }
}
```

## Open Questions

1. **Endpoint consolidation: return via old `/status` or new `/return`?**
   - What we know: Old endpoint `PUT /payments/checks/{id}/status` exists, has no role guard, and `salesApi.returnCheck` calls it
   - What's unclear: Should we replace the old endpoint with a new `/return` endpoint, or keep both?
   - Recommendation: Create the new `/return` endpoint with `require_admin` and leave the old `/status` endpoint in place (it's already callable and `salesApi.returnCheck` uses it). The planner can decide if the old endpoint needs `require_admin` added.

2. **Check list in AdminService vs TransactionRepository?**
   - What we know: `AdminService` uses raw SQL + ORM for complex queries; `TransactionRepository` handles simpler per-customer queries
   - What's unclear: Should `get_all_checks()` live in AdminService (as a method) or TransactionRepository (as a new `get_all_checks` method)?
   - Recommendation: Put it in `AdminService` following the existing `get_debt_stats()` pattern — it requires a JOIN and is an admin-only query.

3. **Client-side vs server-side status filter?**
   - What we know: The filter is All|Pending|Deposited|Returned with default Pending
   - What's unclear: Should filtering happen client-side (fetch all, filter in React) or server-side (pass `?status=` param)?
   - Recommendation: Server-side filtering via `?status=` query param. This avoids loading all historical check data (could be large over time). React Query caches each `["admin-checks", status]` key separately.

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `backend/app/services/payment_service.py`: Existing return_check pattern, state guard via HorizonException(409)
- Codebase direct read — `backend/app/models/transaction.py`: TransactionStatus enum, TransactionType enum
- Codebase direct read — `frontend/src/components/Admin/index.tsx`: AdminView union, navItems, renderView, isMainView, BottomNav 5-item limit
- Codebase direct read — `frontend/src/components/ui/bottom-nav.tsx`: Confirmed 5-item slice
- Codebase direct read — `frontend/src/components/ui/badge.tsx`: warning/success/destructive variants confirmed
- Codebase direct read — `frontend/src/components/ui/confirmation-dialog.tsx`: Props interface (no extra fields slot)
- Codebase direct read — `frontend/src/components/Sales/StatementView.tsx`: Transaction render pattern, Badge usage
- Codebase direct read — `frontend/src/services/salesApi.ts`: Existing returnCheck endpoint URL
- Codebase direct read — `backend/app/api/deps.py`: require_admin, require_sales dependency definitions
- Codebase direct read — `backend/app/api/endpoints/admin.py`: Admin router pattern
- Codebase direct read — `.planning/config.json`: nyquist_validation not set — validation section skipped

### Secondary (MEDIUM confidence)
- None required — all findings from direct codebase reads

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components verified in codebase; no external libraries needed
- Architecture: HIGH — patterns verified directly from existing implementations
- Pitfalls: HIGH — identified from actual code gaps (RBAC gap, isMainView gap, notes param missing) via code reads

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable codebase; valid until major refactor)
