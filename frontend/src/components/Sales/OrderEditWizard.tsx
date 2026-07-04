import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, Trash2, Undo2, Package, Pencil } from "@/lib/icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/search-input";
import { OptionPickerDialog } from "@/components/ui/option-picker-dialog";
import { StepWizard, type WizardStep } from "@/components/ui/step-wizard";
import { CustomerSelector } from "@/components/Sales/views/CustomerSelector";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/useToast";
import {
  salesApi,
  type OrderWithCustomer,
  type OrderItem,
  type CartItem,
  type Product,
  type Customer,
  type DiscountType,
} from "@/services/salesApi";
import { cartKey } from "@/lib/cart";
import { hydrateOrderItems, serializeCart } from "@/lib/orderCart";
import { getImageUrl, getCoverImage, sortProductsByName } from "@/lib/image";
import { getProductName } from "@/lib/product";
import { formatCurrency } from "@/lib/format";
import { toLocalDateStr } from "@/lib/utils";

interface OrderEditWizardProps {
  order: OrderWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Refresh every surface that lists orders (Sales route + Admin tab + briefing). */
const ORDER_LIST_KEYS = [
  ["delivery-orders"],
  ["admin-orders"],
  ["route-day"],
  ["my-orders-today"],
] as const;

export function OrderEditWizard({ order, open, onOpenChange }: OrderEditWizardProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isDelivered = !!(order as any)?.delivered_date;

  // ── Edit state ──────────────────────────────────────────────────────────────
  const { cart, addToCart, updateCartQty, clearCart } = useCart(); // no storageKey → not persisted
  const [legacy, setLegacy] = useState<OrderItem[]>([]);
  // Historical unit_price per cartKey for lines already in the order — preserved
  // on save so an edit never silently reprices existing lines (see orderCart.ts).
  const [origPrices, setOrigPrices] = useState<Map<string, number>>(new Map());
  // Tapping an order shows a read-only summary first; Edit enters the wizard.
  const [editing, setEditing] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [done, setDone] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: salesApi.getProducts,
    enabled: open,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["my-customers"],
    queryFn: salesApi.getMyCustomers,
    enabled: open && !isDelivered,
  });

  // Seed cart/customer/date/notes once per open, after products resolve so
  // product_ids can be matched (unmatched lines become `legacy`).
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !order) {
      seededFor.current = null;
      return;
    }
    if (isDelivered) return; // delivered → read-only summary, no cart needed
    if (seededFor.current === order.id) return;
    if (products.length === 0) return; // wait for catalog

    const orderItems = ((order.data as any)?.items ?? []) as OrderItem[];
    const {
      cart: seededCart,
      legacy: seededLegacy,
      prices: seededPrices,
    } = hydrateOrderItems(orderItems, products);
    clearCart();
    for (const item of seededCart.values()) {
      addToCart(item.product, item.quantity, item.selectedOptions);
    }
    setLegacy(seededLegacy);
    setOrigPrices(seededPrices);
    setCustomerId(order.customer_id);
    setDeliveryDate(
      order.delivery_date ? new Date(order.delivery_date + "T00:00:00") : undefined
    );
    setNotes(order.notes || "");
    seededFor.current = order.id;
  }, [open, order, isDelivered, products, addToCart, clearCart]);

  // Every fresh open (or a different order) starts on the summary, not mid-edit.
  useEffect(() => {
    if (open) setEditing(false);
  }, [open, order?.id]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidate = () => {
    for (const key of ORDER_LIST_KEYS) {
      queryClient.invalidateQueries({ queryKey: key as unknown as string[] });
    }
  };

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof salesApi.updateOrder>[1]) =>
      salesApi.updateOrder(order!.id, payload),
    onSuccess: () => {
      invalidate();
      setDone(true);
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: () => salesApi.deleteOrder(order!.id),
    onSuccess: () => {
      setConfirmDeleteOpen(false);
      invalidate();
      toast({ title: t("toast.success"), variant: "success" });
      onOpenChange(false);
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  const [confirmUndeliverOpen, setConfirmUndeliverOpen] = useState(false);
  const undeliverMutation = useMutation({
    mutationFn: () => salesApi.undeliverOrder(order!.id),
    onSuccess: () => {
      setConfirmUndeliverOpen(false);
      invalidate();
      toast({ title: t("toast.success"), variant: "success" });
      onOpenChange(false);
    },
    onError: () => toast({ title: t("toast.error"), variant: "error" }),
  });

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedCustomer: Customer | null = useMemo(() => {
    if (!customerId) return null;
    return (
      customers.find((c) => c.id === customerId) ??
      ({ id: customerId, name: order?.customer_name ?? "", city: "" } as Customer)
    );
  }, [customerId, customers, order]);

  const filtered = useMemo(() => {
    const list = !search.trim()
      ? products
      : products.filter((p) => {
          const q = search.toLowerCase();
          return (
            p.name_ar.toLowerCase().includes(q) ||
            p.name_en.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q)
          );
        });
    return sortProductsByName(list);
  }, [products, search]);

  const lineCount = cart.size + legacy.length;

  // Historical price for existing lines, current catalog price for new ones.
  const lineUnitPrice = (key: string, item: CartItem) => {
    const historical = origPrices.get(key);
    if (historical != null) return historical;
    return item.selectedOptions?.length
      ? item.selectedOptions[0].price
      : item.product.discounted_price ?? item.product.price;
  };

  const cartTotal = useMemo(() => {
    let sum = 0;
    for (const [key, item] of cart) sum += lineUnitPrice(key, item) * item.quantity;
    for (const l of legacy) sum += l.quantity * l.unit_price;
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, legacy, origPrices]);

  const productCartQty = (productId: string) => {
    let total = 0;
    for (const [, item] of cart) {
      if (item.product.id === productId) total += item.quantity;
    }
    return total;
  };

  const handleAdd = (product: Product) => {
    if (product.options?.length) setPickerProduct(product);
    else addToCart(product);
  };

  const setLegacyQty = (idx: number, qty: number) => {
    setLegacy((prev) =>
      qty <= 0
        ? prev.filter((_, i) => i !== idx)
        : prev.map((l, i) => (i === idx ? { ...l, quantity: qty } : l))
    );
  };

  // ── Reset & close ─────────────────────────────────────────────────────────────
  const close = () => {
    onOpenChange(false);
    setDone(false);
    setSearch("");
    seededFor.current = null;
    clearCart();
    setLegacy([]);
    setOrigPrices(new Map());
    setEditing(false);
  };

  const handleConfirm = () => {
    if (!order || lineCount < 1) {
      toast({ title: t("orderEdit.needItem"), variant: "warning" });
      return;
    }
    const items = serializeCart(cart, legacy, origPrices);
    const discount = (order.data as any)?.discount as
      | { type: DiscountType; value: number }
      | undefined;
    updateMutation.mutate({
      customer_id: customerId ?? undefined,
      items,
      delivery_date: deliveryDate ? toLocalDateStr(deliveryDate) : null,
      notes: notes || undefined,
      ...(discount
        ? { discount_type: discount.type, discount_value: discount.value }
        : {}),
    });
  };

  if (!order) return null;

  // ── Read-only summary — shown first; delivered orders can't leave it ──────────
  if (isDelivered || !editing) {
    const items = ((order.data as any)?.items ?? []) as OrderItem[];
    const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{order.customer_name}</DialogTitle>
          </DialogHeader>
          {isDelivered && (
            <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-success">
              <span className="text-body-sm font-semibold">
                {t("order.deliveredLocked")}
              </span>
            </div>
          )}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <ReadOnlyLine key={idx} item={item} />
            ))}
          </div>
          <div className="flex justify-between border-t pt-3">
            <p className="font-semibold">{t("order.total")}</p>
            <p className="font-semibold" dir="ltr">
              ₪ {formatCurrency(total)}
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("order.deleteOrder")}
            </Button>
            {isDelivered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmUndeliverOpen(true)}
              >
                <Undo2 className="h-4 w-4" />
                {t("order.undeliver")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                {t("order.editOrder")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>

        <ConfirmationDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title={t("order.deleteOrder")}
          description={t("order.deleteOrderMessage")}
          confirmLabel={t("actions.delete")}
          cancelLabel={t("actions.cancel")}
          onConfirm={() => deleteMutation.mutate()}
          variant="destructive"
          isLoading={deleteMutation.isPending}
        />
        <ConfirmationDialog
          open={confirmUndeliverOpen}
          onOpenChange={setConfirmUndeliverOpen}
          title={t("order.undeliver")}
          description={t("order.undeliverMessage")}
          confirmLabel={t("actions.confirm")}
          cancelLabel={t("actions.cancel")}
          onConfirm={() => undeliverMutation.mutate()}
          isLoading={undeliverMutation.isPending}
        />
      </Dialog>
    );
  }

  // ── Editable wizard ───────────────────────────────────────────────────────────
  const steps: WizardStep[] = [
    {
      key: "customer",
      title: t("orderEdit.customerTitle"),
      hint: t("orderEdit.customerHint"),
      canAdvance: !!customerId,
      content: (
        <CustomerSelector
          customers={customers}
          selected={selectedCustomer}
          onSelect={(c) => setCustomerId(c.id)}
        />
      ),
    },
    {
      key: "products",
      title: t("orderEdit.productsTitle"),
      hint: t("orderEdit.productsHint"),
      canAdvance: lineCount >= 1,
      content: (
        <div className="space-y-3">
          {/* Unavailable / deleted-product lines — removable, qty-editable */}
          {legacy.map((item, idx) => (
            <Card key={`legacy-${idx}`} variant="glass" className="p-3">
              <div className="flex gap-3">
                {getImageUrl(item.image_url) ? (
                  <img
                    src={getImageUrl(item.image_url)!}
                    alt={item.name}
                    className="h-14 w-14 rounded-xl bg-muted object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold">{item.name}</p>
                  <Badge variant="warning" size="sm" className="mt-0.5">
                    {t("orderEdit.unavailable")}
                  </Badge>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => setLegacyQty(idx, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="min-w-[1.5rem] text-center text-body-sm font-bold">
                      {item.quantity}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => setLegacyQty(idx, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => setLegacyQty(idx, 0)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <SearchInput
            value={search}
            placeholder={t("catalog.search")}
            onChange={setSearch}
            onSearch={setSearch}
          />

          <div className="space-y-2">
            {filtered.map((product) => {
              const key = cartKey(product.id);
              const inCart = cart.get(key);
              const totalQty = productCartQty(product.id);
              const withOptions = !!product.options?.length;
              return (
                <Card key={product.id} variant="glass" className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
                      {getCoverImage(product) ? (
                        <img
                          src={getCoverImage(product)!}
                          alt={getProductName(product)}
                          className="h-full w-full rounded-xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-semibold">
                        {getProductName(product)}
                      </p>
                      <p className="mt-0.5 text-body-sm font-bold text-primary">
                        {formatCurrency(product.discounted_price ?? product.price)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {!withOptions && inCart ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateCartQty(key, inCart.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="min-w-[1.5rem] text-center text-body-sm font-bold">
                            {inCart.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateCartQty(key, inCart.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Button
                            size="icon"
                            variant="glass"
                            className="h-8 w-8"
                            onClick={() => handleAdd(product)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          {withOptions && totalQty > 0 && (
                            <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-bold text-primary-foreground">
                              {totalQty}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      key: "delivery",
      title: t("orderEdit.deliveryTitle"),
      hint: t("orderEdit.deliveryHint"),
      canAdvance: true,
      content: (
        <div className="space-y-4">
          <FormField label={t("catalog.deliveryDate")}>
            <DatePicker value={deliveryDate} onChange={setDeliveryDate} />
          </FormField>
          <FormField label={t("order.notes")}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("order.addNotes")}
            />
          </FormField>
        </div>
      ),
    },
    {
      key: "review",
      title: t("orderEdit.reviewTitle"),
      hint: t("orderEdit.reviewHint"),
      canAdvance: lineCount >= 1,
      content: (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background-subtle px-3 py-2.5">
            <p className="text-caption text-muted-foreground">
              {t("orderEdit.customerTitle")}
            </p>
            <p className="text-body-sm font-semibold">
              {selectedCustomer?.name || order.customer_name}
            </p>
          </div>

          <div className="space-y-2">
            {Array.from(cart.entries()).map(([key, item]) => (
              <ReviewLine
                key={key}
                name={getProductName(item.product)}
                image={getCoverImage(item.product)}
                optionsText={item.selectedOptions
                  ?.map((o) => `${o.name}: ${o.value}`)
                  .join(" | ")}
                quantity={item.quantity}
                unitPrice={lineUnitPrice(key, item)}
              />
            ))}
            {legacy.map((item, idx) => (
              <ReviewLine
                key={`legacy-${idx}`}
                name={item.name}
                image={getImageUrl(item.image_url)}
                optionsText={item.selected_options
                  ?.map((o) => `${o.name}: ${o.value}`)
                  .join(" | ")}
                quantity={item.quantity}
                unitPrice={item.unit_price}
                unavailable={t("orderEdit.unavailable")}
              />
            ))}
          </div>

          {deliveryDate && (
            <div className="flex justify-between text-body-sm">
              <span className="text-muted-foreground">
                {t("catalog.deliveryDate")}
              </span>
              <span dir="ltr">{toLocalDateStr(deliveryDate)}</span>
            </div>
          )}
          {notes && (
            <div className="text-body-sm">
              <span className="text-muted-foreground">{t("order.notes")}: </span>
              <span>{notes}</span>
            </div>
          )}

          <div className="flex justify-between border-t pt-3">
            <p className="font-semibold">{t("order.total")}</p>
            <p className="font-semibold" dir="ltr">
              ₪ {formatCurrency(cartTotal)}
            </p>
          </div>

          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t("order.deleteOrder")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <StepWizard
        open={open}
        onClose={close}
        done={done}
        submitting={updateMutation.isPending}
        onComplete={handleConfirm}
        steps={steps}
        dir={isRTL ? "rtl" : "ltr"}
        width={440}
        successMessage={t("orderEdit.successTitle")}
        successHint={t("orderEdit.successHint")}
        labels={{
          next: t("orderEdit.next"),
          back: t("orderEdit.back"),
          complete: t("orderEdit.complete"),
          done: t("orderEdit.done"),
          close: t("orderEdit.close"),
          stepCounter: (current, total) =>
            t("orderEdit.step", { current, total }),
        }}
        theme={{
          paper: "hsl(var(--card))",
          ink: "hsl(var(--foreground))",
          muted: "hsl(var(--muted-foreground))",
          rule: "hsl(var(--border))",
          soft: "hsl(var(--secondary))",
          accent: "hsl(var(--primary))",
          onAccent: "hsl(var(--primary-foreground))",
        }}
      />

      <OptionPickerDialog
        product={pickerProduct}
        onOpenChange={(o) => {
          if (!o) setPickerProduct(null);
        }}
        onAdd={(product, qty, options) => {
          addToCart(product, qty, options);
          setPickerProduct(null);
        }}
      />

      <ConfirmationDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("order.deleteOrder")}
        description={t("order.deleteOrderMessage")}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        onConfirm={() => deleteMutation.mutate()}
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

function ReadOnlyLine({ item }: { item: OrderItem }) {
  return (
    <Card variant="glass" className="p-3">
      <div className="flex gap-3">
        {getImageUrl(item.image_url) ? (
          <img
            src={getImageUrl(item.image_url)!}
            alt={item.name}
            className="h-16 w-16 rounded-xl bg-muted object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold">{item.name}</p>
          {item.selected_options && item.selected_options.length > 0 && (
            <p className="text-caption text-muted-foreground">
              {item.selected_options.map((o) => `${o.name}: ${o.value}`).join(" | ")}
            </p>
          )}
          <p className="text-caption text-muted-foreground" dir="ltr">
            {item.quantity} × ₪ {formatCurrency(item.unit_price)}
          </p>
        </div>
        <div className="text-end">
          <p className="text-body-sm font-semibold" dir="ltr">
            ₪ {formatCurrency(item.quantity * item.unit_price)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function ReviewLine({
  name,
  image,
  optionsText,
  quantity,
  unitPrice,
  unavailable,
}: {
  name: string;
  image: string | null;
  optionsText?: string;
  quantity: number;
  unitPrice: number;
  unavailable?: string;
}) {
  return (
    <Card variant="glass" className="p-3">
      <div className="flex gap-3">
        {image ? (
          <img src={image} alt={name} className="h-14 w-14 rounded-xl bg-muted object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold">{name}</p>
          {unavailable && (
            <Badge variant="warning" size="sm" className="mt-0.5">
              {unavailable}
            </Badge>
          )}
          {optionsText && (
            <p className="text-caption text-muted-foreground">{optionsText}</p>
          )}
          <p className="text-caption text-muted-foreground" dir="ltr">
            {quantity} × ₪ {formatCurrency(unitPrice)}
          </p>
        </div>
        <div className="text-end">
          <p className="text-body-sm font-semibold" dir="ltr">
            ₪ {formatCurrency(quantity * unitPrice)}
          </p>
        </div>
      </div>
    </Card>
  );
}
