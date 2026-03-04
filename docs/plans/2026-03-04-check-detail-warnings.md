# Check Detail View & Returned-Check Warnings — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add check detail dialog with SVG preview (admin + sales), returned-check warnings on route list and customer dashboard.

**Architecture:** Shared `CheckDetailDialog` component used by both Admin (click check card) and Sales (click returned-check warning). Backend adds a `returned_checks_count` to `CustomerOut` via subquery, and a dedicated endpoint for fetching returned checks by customer.

**Tech Stack:** React, TypeScript, shadcn Dialog, existing CheckPreview SVG component, FastAPI, SQLAlchemy subquery

---

### Task 1: Backend — Add returned_checks_count to CustomerOut

**Files:**
- Modify: `backend/app/schemas/customer.py:40-54`
- Modify: `backend/app/services/customer_service.py` (all queries returning CustomerOut)

**Step 1: Add field to CustomerOut schema**

In `backend/app/schemas/customer.py`, add to `CustomerOut`:

```python
class CustomerOut(BaseModel):
    id: uuid.UUID
    name: str
    city: str
    assigned_day: AssignedDay
    balance: Decimal
    phone: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    avatar_url: str | None = None
    notes: str | None = None
    assigned_to: uuid.UUID | None = None
    returned_checks_count: int = 0

    model_config = {"from_attributes": True}
```

**Step 2: Enrich customer queries with returned check count subquery**

In `backend/app/services/customer_service.py`, find the `get_route_by_day` and `get_all_customers` methods. Add a correlated subquery that counts returned checks per customer.

Add this import at the top:
```python
from sqlalchemy import func as sa_func
from app.models.transaction import Transaction, TransactionType, TransactionStatus
```

Create a helper subquery:
```python
def _returned_checks_subquery():
    return (
        select(sa_func.count())
        .where(
            Transaction.customer_id == Customer.id,
            Transaction.type == TransactionType.Payment_Check,
            Transaction.status == TransactionStatus.Returned,
            Transaction.is_deleted.is_(False),
        )
        .correlate(Customer)
        .scalar_subquery()
        .label("returned_checks_count")
    )
```

Then update each method that returns `list[CustomerOut]` to include this subquery in the select, and map it onto the result. The exact approach depends on how the current queries are structured — read `customer_service.py` to determine the pattern.

If queries use `select(Customer)`, change to `select(Customer, _returned_checks_subquery())` and map the count onto each customer object before returning.

**Step 3: Commit**

```bash
git add backend/app/schemas/customer.py backend/app/services/customer_service.py
git commit -m "feat: add returned_checks_count to CustomerOut schema"
```

---

### Task 2: Backend — Add GET /customers/{id}/returned-checks endpoint

**Files:**
- Modify: `backend/app/services/payment_service.py`
- Modify: `backend/app/api/endpoints/customers.py`

**Step 1: Add service method**

In `backend/app/services/payment_service.py`, add method to `PaymentService`:

```python
async def get_customer_returned_checks(
    self, customer_id: uuid.UUID
) -> list[Transaction]:
    """Get all returned checks for a given customer."""
    return await self._transactions.find_by_filters(
        customer_id=customer_id,
        type=TransactionType.Payment_Check,
        status=TransactionStatus.Returned,
    )
```

Note: Check how `transaction_repository` supports filtering. If `find_by_filters` doesn't exist, add a query method that filters by customer_id + type + status. The returned list needs to include customer_name — follow the same pattern as `admin_service.get_all_checks()` (join with Customer table, return `CheckOut` schema).

Actually, to return `CheckOut` (which includes `customer_name`), it's better to add this to `admin_service.py` or create a standalone query in payment_service that does the join. The simplest approach: reuse `admin_service.get_all_checks()` pattern but add a `customer_id` filter.

In `backend/app/services/payment_service.py`, add:

```python
from sqlalchemy import select
from app.models.customer import Customer
from app.schemas.admin import CheckOut

async def get_customer_returned_checks(
    self, customer_id: uuid.UUID, db
) -> list[CheckOut]:
    query = (
        select(Transaction, Customer.name.label("customer_name"))
        .join(Customer, Transaction.customer_id == Customer.id)
        .where(
            Transaction.customer_id == customer_id,
            Transaction.type == TransactionType.Payment_Check,
            Transaction.status == TransactionStatus.Returned,
            Transaction.is_deleted.is_(False),
        )
        .order_by(Transaction.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()
    return [
        CheckOut(
            id=row.Transaction.id,
            customer_id=row.Transaction.customer_id,
            customer_name=row.customer_name,
            type=row.Transaction.type,
            currency=row.Transaction.currency,
            amount=row.Transaction.amount,
            status=row.Transaction.status,
            notes=row.Transaction.notes,
            data=row.Transaction.data,
            created_at=row.Transaction.created_at.isoformat(),
            related_transaction_id=row.Transaction.related_transaction_id,
        )
        for row in rows
    ]
```

Note: Adjust based on how the service accesses the DB session. If it uses `self.db` or `self._transactions._session`, use that instead of a `db` parameter. Read the existing code patterns to determine the right approach.

**Step 2: Add endpoint**

In `backend/app/api/endpoints/customers.py`, add:

```python
from app.schemas.admin import CheckOut

@router.get(
    "/{customer_id}/returned-checks",
    response_model=list[CheckOut],
    dependencies=[require_sales],  # Sales + Admin can access
)
async def customer_returned_checks(
    customer_id: uuid.UUID,
    current_user: CurrentUser,
    service: PaymentSvc,  # Add PaymentSvc dependency if not already imported
) -> list[CheckOut]:
    return await service.get_customer_returned_checks(customer_id)
```

Make sure `PaymentSvc` dependency is imported. Check the existing deps pattern in `backend/app/api/deps.py`.

**Step 3: Commit**

```bash
git add backend/app/services/payment_service.py backend/app/api/endpoints/customers.py
git commit -m "feat: add GET /customers/{id}/returned-checks endpoint"
```

---

### Task 3: Frontend — Create CheckDetailDialog shared component

**Files:**
- Create: `frontend/src/components/ui/check-detail-dialog.tsx`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/ar.json`

**Step 1: Add locale keys**

In `en.json`, add to the `checks` namespace:

```json
"checkDetail": {
  "title": "Check Details",
  "bank": "Bank",
  "branch": "Branch",
  "account": "Account",
  "holder": "Holder",
  "dueDate": "Due Date",
  "amount": "Amount",
  "currency": "Currency",
  "checkNumber": "Check #",
  "returnedWarning": "This customer has {{count}} returned check(s)",
  "returnedWarningShort": "{{count}} returned",
  "viewCheck": "View Check",
  "of": "of"
}
```

In `ar.json`, add matching Arabic translations:

```json
"checkDetail": {
  "title": "تفاصيل الشيك",
  "bank": "البنك",
  "branch": "الفرع",
  "account": "الحساب",
  "holder": "صاحب الشيك",
  "dueDate": "تاريخ الاستحقاق",
  "amount": "المبلغ",
  "currency": "العملة",
  "checkNumber": "رقم الشيك",
  "returnedWarning": "هذا العميل لديه {{count}} شيك(ات) مرتجعة",
  "returnedWarningShort": "{{count}} مرتجع",
  "viewCheck": "عرض الشيك",
  "of": "من"
}
```

**Step 2: Create CheckDetailDialog**

Create `frontend/src/components/ui/check-detail-dialog.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Banknote, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckPreview } from "@/components/Sales/CheckPreview";
import type { CheckOut } from "@/services/adminApi";

interface CheckDetailNavigation {
  onPrev?: () => void;
  onNext?: () => void;
  current: number;
  total: number;
}

interface CheckDetailDialogProps {
  check: CheckOut | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeposit?: (id: string) => void;
  onReturn?: (id: string) => void;
  navigation?: CheckDetailNavigation;
}

const statusVariant = (status: string | null) => {
  if (status === "Pending") return "warning" as const;
  if (status === "Deposited") return "success" as const;
  if (status === "Returned") return "destructive" as const;
  return "outline" as const;
};

export function CheckDetailDialog({
  check,
  open,
  onOpenChange,
  onDeposit,
  onReturn,
  navigation,
}: CheckDetailDialogProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  if (!check) return null;

  const data = check.data;
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{check.customer_name}</DialogTitle>
            <Badge variant={statusVariant(check.status)} size="sm">
              {check.status
                ? t(`checks.status.${check.status}`, check.status)
                : "—"}
            </Badge>
          </div>
        </DialogHeader>

        {/* SVG Check Preview */}
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <CheckPreview
            amount={Math.abs(check.amount).toString()}
            currency={(data?.currency as "ILS" | "USD" | "JOD") ?? check.currency as "ILS" | "USD" | "JOD"}
            bankName={data?.bank ?? ""}
            bankNumber={data?.bank_number ?? ""}
            branchNumber={data?.branch_number ?? ""}
            accountNumber={data?.account_number ?? ""}
            holderName={data?.holder_name ?? ""}
            dueDate={data?.due_date ?? ""}
          />
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-body-sm">
          <div>
            <p className="text-caption text-muted-foreground">{t("checkDetail.amount")}</p>
            <p className="font-semibold text-foreground">
              {Math.abs(check.amount).toFixed(2)} {check.currency}
            </p>
          </div>
          {data?.bank && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.bank")}</p>
              <p className="font-medium text-foreground">{data.bank}</p>
            </div>
          )}
          {data?.branch_number && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.branch")}</p>
              <p className="font-medium text-foreground">{data.branch_number}</p>
            </div>
          )}
          {data?.account_number && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.account")}</p>
              <p className="font-medium text-foreground">{data.account_number}</p>
            </div>
          )}
          {data?.holder_name && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.holder")}</p>
              <p className="font-medium text-foreground">{data.holder_name}</p>
            </div>
          )}
          {data?.due_date && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.dueDate")}</p>
              <p className="font-medium text-foreground">{data.due_date}</p>
            </div>
          )}
        </div>

        {/* Navigation (for multi-check browsing) */}
        {navigation && navigation.total > 1 && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={navigation.onPrev}
              disabled={!navigation.onPrev}
            >
              <PrevIcon className="h-4 w-4" />
            </Button>
            <span className="text-caption text-muted-foreground">
              {navigation.current} {t("checkDetail.of")} {navigation.total}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={navigation.onNext}
              disabled={!navigation.onNext}
            >
              <NextIcon className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Action buttons */}
        {(onDeposit || onReturn) && (
          <div className="flex items-center gap-2 pt-2">
            {onDeposit && check.status === "Pending" && (
              <Button className="flex-1" onClick={() => onDeposit(check.id)}>
                <Banknote className="h-4 w-4" />
                {t("checks.deposit")}
              </Button>
            )}
            {onReturn &&
              (check.status === "Pending" || check.status === "Deposited") && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onReturn(check.id)}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("checks.return")}
                </Button>
              )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/ui/check-detail-dialog.tsx frontend/src/locales/en.json frontend/src/locales/ar.json
git commit -m "feat: create CheckDetailDialog shared component"
```

---

### Task 4: Frontend — Add icon + click-to-detail in AdminChecksView

**Files:**
- Modify: `frontend/src/components/Admin/AdminChecksView.tsx`

**Step 1: Add icon and click handler**

Import `FileCheck2` from lucide-react and `CheckDetailDialog`:

```tsx
import { Banknote, RotateCcw, FileCheck2 } from "lucide-react";
import { CheckDetailDialog } from "@/components/ui/check-detail-dialog";
```

Add state for the detail dialog:
```tsx
const [detailDialogOpen, setDetailDialogOpen] = useState(false);
```

**Step 2: Update check card rendering**

Add `FileCheck2` icon before customer name, and make the card clickable to open the detail dialog:

In the card's `CardContent`, wrap the top row in a clickable div:

```tsx
<Card
  key={check.id}
  variant="glass"
  className="cursor-pointer"
  onClick={() => {
    setSelectedCheck(check);
    setDetailDialogOpen(true);
  }}
>
```

Add `FileCheck2` icon before the customer name:
```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2 min-w-0">
    <FileCheck2 className="h-4 w-4 text-primary shrink-0" />
    <p className="text-body-sm font-semibold text-foreground truncate">
      {check.customer_name}
    </p>
  </div>
  ...
</div>
```

Move deposit/return buttons to stopPropagation onClick so they don't trigger card click.

**Step 3: Add CheckDetailDialog to the component**

Add before the closing `</div>`:

```tsx
<CheckDetailDialog
  check={selectedCheck}
  open={detailDialogOpen}
  onOpenChange={setDetailDialogOpen}
  onDeposit={(id) => {
    depositMutation.mutate(id);
    setDetailDialogOpen(false);
  }}
  onReturn={(id) => {
    setDetailDialogOpen(false);
    setReturnNotes("");
    setReturnDialogOpen(true);
  }}
/>
```

**Step 4: Commit**

```bash
git add frontend/src/components/Admin/AdminChecksView.tsx
git commit -m "feat: add check icon and detail dialog to AdminChecksView"
```

---

### Task 5: Frontend — Add salesApi.getReturnedChecks method

**Files:**
- Modify: `frontend/src/services/salesApi.ts`
- Modify: `frontend/src/services/adminApi.ts` (export CheckOut type if not already)

**Step 1: Add API method**

In `frontend/src/services/salesApi.ts`, add to the `salesApi` object:

```typescript
getReturnedChecks: (customerId: string) =>
  api
    .get<import("./adminApi").CheckOut[]>(
      `/customers/${customerId}/returned-checks`
    )
    .then((r) => r.data),
```

**Step 2: Update Customer interface**

In `frontend/src/services/salesApi.ts`, add to the `Customer` interface:

```typescript
returned_checks_count?: number;
```

**Step 3: Commit**

```bash
git add frontend/src/services/salesApi.ts
git commit -m "feat: add getReturnedChecks API method and returned_checks_count to Customer"
```

---

### Task 6: Frontend — Add returned-check warning to CustomerDashboard

**Files:**
- Modify: `frontend/src/components/Sales/CustomerDashboard.tsx`

**Step 1: Add imports and query**

```tsx
import { AlertTriangle } from "lucide-react";
import { CheckDetailDialog } from "@/components/ui/check-detail-dialog";
import type { CheckOut } from "@/services/adminApi";
```

Add state and query:
```tsx
const [returnedCheckIdx, setReturnedCheckIdx] = useState(0);
const [returnedCheckDialogOpen, setReturnedCheckDialogOpen] = useState(false);

const { data: returnedChecks } = useQuery({
  queryKey: ["returned-checks", customer.id],
  queryFn: () => salesApi.getReturnedChecks(customer.id),
  enabled: (customer.returned_checks_count ?? 0) > 0,
});
```

**Step 2: Add warning card before insight stats**

Insert this JSX right after `<div className="space-y-5 p-4">` and before the insight stats section:

```tsx
{(customer.returned_checks_count ?? 0) > 0 && (
  <Card
    variant="glass"
    className="border-destructive/30 bg-destructive/5 cursor-pointer animate-slide-up"
    onClick={() => {
      setReturnedCheckIdx(0);
      setReturnedCheckDialogOpen(true);
    }}
  >
    <CardContent className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-destructive">
          {t("checkDetail.returnedWarning", {
            count: customer.returned_checks_count,
          })}
        </p>
        <p className="text-caption text-muted-foreground">
          {t("checkDetail.viewCheck")}
        </p>
      </div>
    </CardContent>
  </Card>
)}
```

**Step 3: Add CheckDetailDialog with navigation**

Before the closing `</div>` of the component:

```tsx
{returnedChecks && returnedChecks.length > 0 && (
  <CheckDetailDialog
    check={returnedChecks[returnedCheckIdx] ?? null}
    open={returnedCheckDialogOpen}
    onOpenChange={setReturnedCheckDialogOpen}
    navigation={
      returnedChecks.length > 1
        ? {
            current: returnedCheckIdx + 1,
            total: returnedChecks.length,
            onPrev:
              returnedCheckIdx > 0
                ? () => setReturnedCheckIdx((i) => i - 1)
                : undefined,
            onNext:
              returnedCheckIdx < returnedChecks.length - 1
                ? () => setReturnedCheckIdx((i) => i + 1)
                : undefined,
          }
        : undefined
    }
  />
)}
```

**Step 4: Commit**

```bash
git add frontend/src/components/Sales/CustomerDashboard.tsx
git commit -m "feat: add returned-check warning card to CustomerDashboard"
```

---

### Task 7: Frontend — Add returned-check badge to RouteView customer cards

**Files:**
- Modify: `frontend/src/components/Sales/RouteView.tsx`

**Step 1: Add AlertTriangle import**

```tsx
import { AlertTriangle } from "lucide-react";
```

**Step 2: Add badge to customer card**

In the customer card rendering (around line 367-384), between the customer name/city div and the balance badge div, add a returned-check indicator:

```tsx
{(customer.returned_checks_count ?? 0) > 0 && (
  <div className="flex items-center gap-1 shrink-0">
    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
    <Badge variant="destructive" size="sm">
      {customer.returned_checks_count}
    </Badge>
  </div>
)}
```

Place it inside the `<div className="flex items-center gap-2 shrink-0">` that contains the balance badge, before the balance badge.

**Step 3: Commit**

```bash
git add frontend/src/components/Sales/RouteView.tsx
git commit -m "feat: add returned-check warning badge to route customer cards"
```

---

### Task 8: Build verification

**Step 1: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

**Step 2: Run Vite build**

```bash
cd frontend && bun build
```

Expected: Build succeeds with no errors

**Step 3: Fix any issues found**

If there are type errors or build failures, fix them.

**Step 4: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve build issues for check detail features"
```
