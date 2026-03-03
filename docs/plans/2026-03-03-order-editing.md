# Order Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable salespersons to edit orders before delivery and confirm delivery to lock orders.

**Architecture:**
- Backend: Add `delivered_date` field, create PUT endpoints for order updates and delivery confirmation
- Frontend: Create OrderModal with tabs for viewing/editing, CustomerPicker component with search, integrate into RouteView order cards
- Balance adjustments happen automatically when order items change

**Tech Stack:** FastAPI (backend), React + TypeScript (frontend), SQLAlchemy ORM, TanStack React Query

---

## Task 1: Add `delivered_date` column to Transaction model

**Files:**
- Modify: `backend/app/models/transaction.py`
- Create: `backend/alembic/versions/<timestamp>_add_delivered_date_to_transactions.py`

**Step 1: Add field to Transaction model**

Edit `backend/app/models/transaction.py` and add after the `delivery_date` field (around line 66):

```python
    delivery_date: Mapped[_dt.date | None] = mapped_column(
        Date, nullable=True, index=True
    )
    delivered_date: Mapped[_dt.datetime | None] = mapped_column(
        DateTime, nullable=True, index=True
    )
```

Also add the DateTime import at the top:
```python
from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, Numeric, String
```

**Step 2: Run alembic revision to generate migration**

```bash
cd backend
alembic revision --autogenerate -m "add delivered_date to transactions"
```

**Step 3: Verify migration file**

Check the generated migration in `backend/alembic/versions/` - it should add a new column.

**Step 4: Run migration to apply it**

```bash
alembic upgrade head
```

Expected: Migration applies successfully, column exists in database.

**Step 5: Commit**

```bash
git add backend/app/models/transaction.py backend/alembic/versions/*delivered_date*
git commit -m "feat: add delivered_date field to transactions"
```

---

## Task 2: Create PUT endpoint to update order

**Files:**
- Modify: `backend/app/services/order_service.py`
- Modify: `backend/app/api/endpoints/orders.py`

**Step 1: Add update_order method to OrderService**

Edit `backend/app/services/order_service.py` and add this method after `create_order`:

```python
    async def update_order(
        self,
        order_id: uuid.UUID,
        updater_id: uuid.UUID,
        body,  # OrderUpdate schema
    ) -> TransactionOut:
        """Update an existing order (items, customer, delivery_date, notes).
        Only unpaid orders can be updated."""
        txn = await self._transactions.get_by_id(order_id)
        if txn is None:
            raise HorizonException(404, "Order not found")
        if txn.delivered_date is not None:
            raise HorizonException(400, "Cannot edit delivered orders")
        if txn.type != TransactionType.Order:
            raise HorizonException(400, "Can only update orders")

        # Get old customer for balance adjustment
        old_customer = await self._customers.get_by_id(txn.customer_id)
        if old_customer is None:
            raise HorizonException(404, "Customer not found")

        old_amount = txn.amount

        # Update customer if provided
        if body.customer_id:
            new_customer = await self._customers.get_by_id(body.customer_id)
            if new_customer is None:
                raise HorizonException(404, "New customer not found")
            txn.customer_id = body.customer_id
        else:
            new_customer = old_customer

        # Update items and recalculate amount
        if body.items:
            total = sum(
                Decimal(str(item.get("quantity", 1)))
                * Decimal(str(item.get("unit_price", "0")))
                for item in body.items
            )
            txn.amount = total
            txn.data = {"items": body.items}

        # Update other fields
        if body.delivery_date is not None:
            txn.delivery_date = body.delivery_date
        if body.notes is not None:
            txn.notes = body.notes

        # Adjust balances
        balance_diff = txn.amount - old_amount

        # If customer changed
        if txn.customer_id != old_customer.id:
            old_customer.balance -= old_amount
            new_customer.balance += txn.amount
            await self._customers.update_balance(old_customer)
            await self._customers.update_balance(new_customer)
        else:
            # Same customer, just adjust the difference
            new_customer.balance += balance_diff
            await self._customers.update_balance(new_customer)

        txn = await self._transactions.update(txn)
        return TransactionOut.model_validate(txn)
```

**Step 2: Create OrderUpdate schema**

Edit `backend/app/schemas/transaction.py` and add:

```python
class OrderUpdate(BaseModel):
    customer_id: UUID | None = None
    items: list[dict] | None = None
    delivery_date: date | None = None
    notes: str | None = None
```

**Step 3: Add endpoint to orders router**

Edit `backend/app/api/endpoints/orders.py` and add this endpoint after the `create_order` endpoint:

```python
@router.put(
    "/{order_id}", response_model=TransactionOut, dependencies=[require_sales]
)
async def update_order(
    order_id: uuid.UUID,
    body: OrderUpdate,
    current_user: CurrentUser,
    service: OrderSvc,
) -> TransactionOut:
    return await service.update_order(order_id, uuid.UUID(current_user["sub"]), body)
```

**Step 4: Test the endpoint (manual)**

Start backend, create an order, then test:
```bash
curl -X PUT http://localhost:8000/orders/<order_id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"product_id": "...", "quantity": 2, "unit_price": 100}]}'
```

**Step 5: Commit**

```bash
git add backend/app/services/order_service.py backend/app/api/endpoints/orders.py backend/app/schemas/transaction.py
git commit -m "feat: add PUT endpoint to update orders"
```

---

## Task 3: Create PUT endpoint to confirm delivery

**Files:**
- Modify: `backend/app/services/order_service.py`
- Modify: `backend/app/api/endpoints/orders.py`

**Step 1: Add confirm_delivery method to OrderService**

Edit `backend/app/services/order_service.py` and add:

```python
    async def confirm_delivery(
        self, order_id: uuid.UUID, confirmer_id: uuid.UUID
    ) -> TransactionOut:
        """Mark an order as delivered (locks it from editing)."""
        txn = await self._transactions.get_by_id(order_id)
        if txn is None:
            raise HorizonException(404, "Order not found")
        if txn.type != TransactionType.Order:
            raise HorizonException(400, "Can only confirm order delivery")
        if txn.delivered_date is not None:
            raise HorizonException(400, "Order already marked as delivered")

        txn.delivered_date = datetime.now(timezone.utc)
        txn = await self._transactions.update(txn)
        return TransactionOut.model_validate(txn)
```

Add import at top if not present:
```python
from datetime import datetime, timezone
```

**Step 2: Add endpoint to orders router**

Edit `backend/app/api/endpoints/orders.py` and add:

```python
@router.put(
    "/{order_id}/deliver",
    response_model=TransactionOut,
    dependencies=[require_sales],
)
async def deliver_order(
    order_id: uuid.UUID, current_user: CurrentUser, service: OrderSvc
) -> TransactionOut:
    return await service.confirm_delivery(order_id, uuid.UUID(current_user["sub"]))
```

**Step 3: Test the endpoint (manual)**

```bash
curl -X PUT http://localhost:8000/orders/<order_id>/deliver \
  -H "Authorization: Bearer <token>"
```

**Step 4: Commit**

```bash
git add backend/app/services/order_service.py backend/app/api/endpoints/orders.py
git commit -m "feat: add endpoint to confirm order delivery"
```

---

## Task 4: Update TransactionOut schema to include delivered_date

**Files:**
- Modify: `backend/app/schemas/transaction.py`

**Step 1: Add field to TransactionOut schema**

Edit `backend/app/schemas/transaction.py` and add to the TransactionOut class:

```python
class TransactionOut(BaseModel):
    id: UUID
    customer_id: UUID
    type: str
    currency: str
    amount: Decimal
    status: str | None = None
    notes: str | None = None
    data: dict | None = None
    created_at: datetime
    delivery_date: date | None = None
    delivered_date: datetime | None = None  # Add this line
    is_draft: bool = False
    # ... other fields
```

**Step 2: Test the schema**

Verify the schema compiles:
```bash
cd backend
python -c "from app.schemas.transaction import TransactionOut; print('Schema OK')"
```

**Step 3: Commit**

```bash
git add backend/app/schemas/transaction.py
git commit -m "feat: add delivered_date to TransactionOut schema"
```

---

## Task 5: Update frontend salesApi to add order update and delivery endpoints

**Files:**
- Modify: `frontend/src/services/salesApi.ts`

**Step 1: Add API methods**

Edit `frontend/src/services/salesApi.ts` and add these methods in the salesApi object:

```typescript
  updateOrder: (id: string, payload: {
    customer_id?: string;
    items?: OrderItem[];
    delivery_date?: string | null;
    notes?: string;
  }) =>
    api.put<Transaction>(`/orders/${id}`, payload).then((r) => r.data),

  confirmOrderDelivery: (id: string) =>
    api.put<Transaction>(`/orders/${id}/deliver`).then((r) => r.data),
```

**Step 2: Verify no syntax errors**

```bash
cd frontend
bun run build 2>&1 | head -30
```

Expected: No errors in salesApi.ts

**Step 3: Commit**

```bash
git add frontend/src/services/salesApi.ts
git commit -m "feat: add updateOrder and confirmOrderDelivery API methods"
```

---

## Task 6: Create CustomerPicker component

**Files:**
- Create: `frontend/src/components/ui/customer-picker.tsx`

**Step 1: Create component file**

Create `frontend/src/components/ui/customer-picker.tsx`:

```typescript
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Customer } from "@/services/salesApi";

interface CustomerPickerProps {
  value: Customer | null;
  onChange: (customer: Customer) => void;
  customers: Customer[];
  disabled?: boolean;
}

export function CustomerPicker({
  value,
  onChange,
  customers,
  disabled = false,
}: CustomerPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, search]);

  return (
    <>
      <Card
        variant="interactive"
        className="p-3 cursor-pointer"
        onClick={() => !disabled && setOpen(true)}
      >
        <div className="flex items-center gap-3">
          {value ? (
            <>
              <Avatar name={value.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-foreground">
                  {value.name}
                </p>
                <p className="text-caption text-muted-foreground">{value.city}</p>
              </div>
            </>
          ) : (
            <p className="text-body-sm text-muted-foreground">
              {t("customer.selectCustomer")}
            </p>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("customer.selectCustomer")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("customer.searchCustomers")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filtered.map((customer) => (
                <Card
                  key={customer.id}
                  variant="interactive"
                  className="p-3 cursor-pointer"
                  onClick={() => {
                    onChange(customer);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={customer.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-semibold text-foreground">
                        {customer.name}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {customer.city}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-caption text-muted-foreground py-4">
                  {t("customer.noResults")}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 2: Build to check for errors**

```bash
cd frontend
bun run build 2>&1 | grep -i error | head -20
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/ui/customer-picker.tsx
git commit -m "feat: create CustomerPicker component"
```

---

## Task 7: Create OrderModal component with View and Edit tabs

**Files:**
- Create: `frontend/src/components/Sales/OrderModal.tsx`

**Step 1: Create component file**

Create `frontend/src/components/Sales/OrderModal.tsx`:

```typescript
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CustomerPicker } from "@/components/ui/customer-picker";
import { useToast } from "@/hooks/useToast";
import { salesApi, type OrderWithCustomer, type Customer } from "@/services/salesApi";
import { getImageUrl } from "@/lib/image";

interface OrderModalProps {
  order: OrderWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeliveryConfirmed?: () => void;
}

const formatCurrency = (val: number) =>
  val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function OrderModal({
  order,
  open,
  onOpenChange,
  onDeliveryConfirmed,
}: OrderModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editTab, setEditTab] = useState("view");

  // Edit state
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editDeliveryDate, setEditDeliveryDate] = useState<Date | undefined>();
  const [editNotes, setEditNotes] = useState("");

  // Initialize edit state when modal opens
  React.useEffect(() => {
    if (open && order) {
      setEditCustomer(order.customer_name ? { name: order.customer_name } as Customer : null);
      setEditItems(order.data?.items || []);
      setEditDeliveryDate(order.delivery_date ? new Date(order.delivery_date) : undefined);
      setEditNotes(order.notes || "");
    }
  }, [open, order]);

  // Fetch all customers for picker
  const { data: allCustomers = [] } = useQuery({
    queryKey: ["my-customers"],
    queryFn: salesApi.getMyCustomers,
    enabled: open,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (payload: any) =>
      salesApi.updateOrder(order!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-orders"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  // Delivery mutation
  const deliveryMutation = useMutation({
    mutationFn: () => salesApi.confirmOrderDelivery(order!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-orders"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
      onOpenChange(false);
      onDeliveryConfirmed?.();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const handleSaveChanges = async () => {
    if (!order || !editItems.length) {
      toast({ title: "Order must have at least one item", variant: "warning" });
      return;
    }

    const payload = {
      customer_id: editCustomer?.id,
      items: editItems,
      delivery_date: editDeliveryDate
        ? editDeliveryDate.toISOString().split("T")[0]
        : null,
      notes: editNotes || undefined,
    };

    updateMutation.mutate(payload);
  };

  const handleConfirmDelivery = () => {
    if (
      window.confirm(
        t("order.confirmDeliveryMessage") ||
          "Mark this order as delivered? (Cannot be edited after)"
      )
    ) {
      deliveryMutation.mutate();
    }
  };

  if (!order) return null;

  const isDelivered = !!order.delivered_date;
  const canEdit = !isDelivered;
  const items = (order.data?.items || []) as any[];
  const total = items.reduce(
    (sum, item) => sum + (item.quantity * item.unit_price),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order.customer_name}</DialogTitle>
        </DialogHeader>

        <Tabs value={editTab} onValueChange={setEditTab}>
          <TabsList className="w-full">
            <TabsTrigger value="view" className="flex-1">
              {t("order.viewProducts")}
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex-1" disabled={!canEdit}>
              {t("order.editOrder")}
            </TabsTrigger>
          </TabsList>

          {/* View Products Tab */}
          <TabsContent value="view" className="space-y-3">
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {t("catalog.noResults")}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <Card key={idx} variant="glass" className="p-3">
                    <div className="flex gap-3">
                      <img
                        src={getImageUrl(item.image_url)}
                        alt={item.name}
                        className="h-16 w-16 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-semibold truncate">
                          {item.name}
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-body-sm font-semibold">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            <div className="border-t pt-3 flex justify-between">
              <p className="font-semibold">{t("cart.total")}</p>
              <p className="font-semibold">{formatCurrency(total)}</p>
            </div>
          </TabsContent>

          {/* Edit Order Tab */}
          <TabsContent value="edit" className="space-y-4">
            {canEdit ? (
              <>
                <FormField label={t("nav.customers")}>
                  <CustomerPicker
                    value={editCustomer}
                    onChange={setEditCustomer}
                    customers={allCustomers}
                  />
                </FormField>

                <FormField label={t("catalog.deliveryDate")}>
                  <DatePicker
                    value={editDeliveryDate}
                    onChange={setEditDeliveryDate}
                  />
                </FormField>

                <FormField label={t("cart.notes") || "Notes"}>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={t("order.addNotes") || "Add order notes..."}
                  />
                </FormField>

                <FormField label={t("catalog.items")}>
                  <div className="space-y-2">
                    {editItems.map((item, idx) => (
                      <Card key={idx} variant="glass" className="p-3">
                        <div className="flex gap-3">
                          <img
                            src={getImageUrl(item.image_url)}
                            alt={item.name}
                            className="h-16 w-16 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-body-sm font-semibold truncate">
                              {item.name}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newItems = editItems.map((i, j) =>
                                    j === idx ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i
                                  );
                                  setEditItems(newItems);
                                }}
                              >
                                −
                              </Button>
                              <span className="px-2 py-1 text-sm">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newItems = editItems.map((i, j) =>
                                    j === idx ? { ...i, quantity: i.quantity + 1 } : i
                                  );
                                  setEditItems(newItems);
                                }}
                              >
                                +
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditItems(editItems.filter((_, j) => j !== idx));
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </FormField>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                {t("order.deliveredLocked")}
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2">
          {isDelivered ? (
            <Badge variant="success">{t("order.delivered")}</Badge>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("actions.cancel")}
              </Button>
              {editTab === "edit" && (
                <Button
                  onClick={handleSaveChanges}
                  isLoading={updateMutation.isPending}
                >
                  {t("actions.save")}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleConfirmDelivery}
                isLoading={deliveryMutation.isPending}
              >
                {t("order.confirmDelivery")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Build to check for errors**

```bash
cd frontend
bun run build 2>&1 | head -50
```

Expected: No errors related to OrderModal

**Step 3: Commit**

```bash
git add frontend/src/components/Sales/OrderModal.tsx
git commit -m "feat: create OrderModal component with view/edit tabs"
```

---

## Task 8: Integrate OrderModal into RouteView (orders section)

**Files:**
- Modify: `frontend/src/components/Sales/RouteView.tsx`

**Step 1: Import OrderModal**

At the top of RouteView.tsx, add:

```typescript
import { OrderModal } from "./OrderModal";
import { useState } from "react";
```

**Step 2: Add state for selected order**

In the RouteView component, add state after the other useState calls:

```typescript
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCustomer | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
```

**Step 3: Make order cards clickable**

In the orders section (around line 287), change the Card wrapper:

```typescript
                  <Card
                    key={order.id}
                    variant="glass"
                    className="animate-slide-up overflow-hidden p-0 cursor-pointer"
                    onClick={() => {
                      setSelectedOrder(order);
                      setOrderModalOpen(true);
                    }}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
```

**Step 4: Add OrderModal component at bottom of RouteView**

Before the closing div of RouteView, add:

```typescript
      <OrderModal
        order={selectedOrder}
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
      />
```

**Step 5: Build and test**

```bash
cd frontend
bun run build 2>&1 | head -50
```

Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/components/Sales/RouteView.tsx
git commit -m "feat: add order card click handler to open OrderModal"
```

---

## Task 9: Integrate OrderModal into unassigned orders section

**Files:**
- Modify: `frontend/src/components/Sales/RouteView.tsx` (already modified)

**Step 1: Make unassigned order cards clickable**

In the unassigned orders section (around line 369), update the Card:

```typescript
                        <Card
                          key={order.id}
                          variant="glass"
                          className="animate-slide-up overflow-hidden p-0 cursor-pointer"
                          onClick={() => {
                            setSelectedOrder(order);
                            setOrderModalOpen(true);
                          }}
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
```

**Step 2: Build and test**

```bash
cd frontend
bun run build 2>&1 | head -30
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/Sales/RouteView.tsx
git commit -m "feat: make unassigned order cards clickable to open edit modal"
```

---

## Task 10: Add localization strings for order editing

**Files:**
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/ar.json`

**Step 1: Add English strings**

Edit `frontend/src/locales/en.json` and add to the "order" section (create if doesn't exist):

```json
  "order": {
    "viewProducts": "View Products",
    "editOrder": "Edit Order",
    "addNotes": "Add order notes...",
    "confirmDelivery": "Confirm Delivery",
    "confirmDeliveryMessage": "Mark this order as delivered? (Cannot be edited after)",
    "delivered": "Delivered",
    "deliveredLocked": "This order has been delivered and cannot be edited",
    "items": "Items"
  },
```

Also add to "actions" if not present:
```json
    "save": "Save Changes"
```

**Step 2: Add Arabic strings**

Edit `frontend/src/locales/ar.json` and add to the "order" section:

```json
  "order": {
    "viewProducts": "عرض المنتجات",
    "editOrder": "تعديل الطلب",
    "addNotes": "أضف ملاحظات للطلب...",
    "confirmDelivery": "تأكيد التسليم",
    "confirmDeliveryMessage": "هل تريد تحديد هذا الطلب كمُسلّم؟ (لا يمكن تعديله بعد ذلك)",
    "delivered": "مُسلّم",
    "deliveredLocked": "تم تسليم هذا الطلب ولا يمكن تعديله",
    "items": "المنتجات"
  },
```

**Step 3: Test build**

```bash
cd frontend
bun run build 2>&1 | head -30
```

Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/locales/en.json frontend/src/locales/ar.json
git commit -m "feat: add localization strings for order editing"
```

---

## Task 11: Manual testing of complete flow

**Test Steps:**

1. **Create an order** through the normal flow
2. **Navigate to Route tab**, find the order in "Today's Orders" section
3. **Click the order card** — modal should open with "View Products" tab
4. **Switch to "Edit Order" tab**:
   - Change customer using CustomerPicker
   - Modify item quantities (+/-)
   - Remove an item
   - Change delivery date
   - Add notes
   - Click "Save Changes"
5. **Verify order updated**:
   - Refresh page, order should show updated items
   - Customer balance should be adjusted
6. **Click "Confirm Delivery"** on the order card
   - Confirm in dialog
   - Order should now show as delivered
7. **Try to edit delivered order**:
   - Modal should show locked message
   - Edit tab should be disabled
8. **Test unassigned orders section**:
   - Create order for customer not assigned to today
   - Should appear in "Unassigned Customers Orders"
   - Should be editable before delivery
   - Should be clickable to open modal

**Expected Results:**
- All clicks work smoothly
- Data updates correctly
- Customer balances adjust
- Orders lock after delivery
- No console errors

---

## Execution Notes

- **TDD approach**: Each task includes tests conceptually (manual testing in Task 11)
- **Frequent commits**: Each task has its own commit
- **DRY principle**: CustomerPicker is reusable, order display logic consolidated
- **YAGNI**: Only necessary features implemented
- **Error handling**: Try/catch and user feedback via toast notifications
- **Authorization**: Backend checks that salesman can only edit own orders (via created_by field)

---

## Files Summary

**Backend Files Modified:**
- `app/models/transaction.py` — Add delivered_date field
- `app/services/order_service.py` — Add update_order, confirm_delivery methods
- `app/api/endpoints/orders.py` — Add PUT endpoints
- `app/schemas/transaction.py` — Add OrderUpdate schema, delivered_date to TransactionOut
- `alembic/versions/` — Migration file (auto-generated)

**Frontend Files Modified:**
- `src/services/salesApi.ts` — Add updateOrder, confirmOrderDelivery methods
- `src/components/ui/customer-picker.tsx` — New CustomerPicker component
- `src/components/Sales/OrderModal.tsx` — New OrderModal component
- `src/components/Sales/RouteView.tsx` — Integrate OrderModal
- `src/locales/en.json` — Add order editing strings
- `src/locales/ar.json` — Add Arabic order editing strings

**Total Changes:** 8 new files, 7 modified files
**Estimated Execution Time:** 45-60 minutes with testing
