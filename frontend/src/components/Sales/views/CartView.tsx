import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Package,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
} from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { TopBar } from "@/components/ui/top-bar";
import {
  type Customer,
  type Product,
  type CartItem,
  type DiscountType,
} from "@/services/salesApi";
import { getUnitPrice } from "@/lib/cart";
import { getCoverImage } from "@/lib/image";
import { formatCurrency } from "@/lib/format";
import { getProductName } from "@/lib/product";
import { FadeIn } from "@/components/ui/fade-in";
import { CustomerSelector } from "./CustomerSelector";

/** Keyboard-editable quantity field. Commits valid positive integers as you
 *  type and snaps back to the last good value if left empty/invalid on blur. */
function CartQtyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (qty: number) => void;
}) {
  const [local, setLocal] = useState(String(value));

  // Keep in sync when the quantity changes from the +/- buttons.
  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label="quantity"
      value={local}
      onFocusCapture={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, "");
        setLocal(digits);
        const n = parseInt(digits, 10);
        if (Number.isFinite(n) && n > 0) onChange(n);
      }}
      onBlur={() => {
        const n = parseInt(local, 10);
        if (!Number.isFinite(n) || n < 1) setLocal(String(value));
      }}
      className="h-9 w-12 rounded-md border border-input bg-background text-center text-body-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

export interface OrderDiscountInput {
  type: DiscountType;
  value: number;
}

export interface CartViewProps {
  cart: Map<string, CartItem>;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  onPlaceOrder: () => void;
  onBrowse: () => void;
  selectedCustomer: Customer | null;
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
  discount: OrderDiscountInput | null;
  onDiscountChange: (discount: OrderDiscountInput | null) => void;
}

/** Resolve a discount input against a subtotal to a shekel amount, clamped. */
export function computeDiscount(
  subtotal: number,
  discount: OrderDiscountInput | null
): number {
  if (!discount || !discount.value || discount.value <= 0) return 0;
  const amt =
    discount.type === "percent"
      ? (subtotal * Math.min(Math.max(discount.value, 0), 100)) / 100
      : discount.value;
  return Math.min(Math.max(amt, 0), subtotal);
}

export function CartView({
  cart,
  updateCartQty,
  removeFromCart,
  clearCart,
  cartTotal,
  onPlaceOrder,
  onBrowse,
  selectedCustomer,
  customers,
  onSelectCustomer,
  discount,
  onDiscountChange,
}: CartViewProps) {
  const { t } = useTranslation();

  const cartEntries = useMemo(() => Array.from(cart.entries()), [cart]);

  const discountAmount = computeDiscount(cartTotal, discount);
  const finalTotal = cartTotal - discountAmount;

  const productName = (p: Product) => getProductName(p);

  if (cartEntries.length === 0) {
    return (
      <FadeIn animation="fade">
        <TopBar title={t("cart.title")} />
        <EmptyState
          icon={ShoppingCart}
          title={t("cart.empty")}
          description={t("cart.browseCatalog")}
          action={{ label: t("nav.catalog"), onClick: onBrowse }}
          className="py-16"
        />
      </FadeIn>
    );
  }

  return (
    <FadeIn animation="fade">
      <TopBar
        title={t("cart.title")}
        actions={
          <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive">
            <Trash2 className="h-4 w-4 me-1" />
            {t("actions.delete")}
          </Button>
        }
      />

      <div className="space-y-3 p-4">
        {/* Customer selector */}
        <CustomerSelector
          customers={customers}
          selected={selectedCustomer}
          onSelect={onSelectCustomer}
        />

        {/* Cart items */}
        <div className="space-y-2">
          {cartEntries.map(([key, ci], idx) => {
            const unitPrice = getUnitPrice(ci.product, ci.selectedOptions);
            return (
              <FadeIn key={key} delay={idx * 0.06}>
              <Card
                variant="glass"
                className="overflow-hidden"
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Product image */}
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                      {getCoverImage(ci.product) ? (
                        <img
                          src={getCoverImage(ci.product)!}
                          alt={productName(ci.product)}
                          className="h-full w-full rounded-lg object-cover"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-semibold text-foreground truncate">
                        {productName(ci.product)}
                      </p>
                      {ci.selectedOptions?.length ? (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {ci.selectedOptions.map((opt) => (
                            <Badge key={`${opt.name}:${opt.value}`} variant="outline" size="sm" className="text-[0.6rem]">
                              {opt.value}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-caption text-muted-foreground mt-0.5">
                        {formatCurrency(unitPrice)} x {ci.quantity}
                      </p>
                      <p className="text-body-sm font-bold text-primary mt-0.5">
                        {formatCurrency(unitPrice * ci.quantity)}
                      </p>
                    </div>

                    {/* Quantity controls + remove */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeFromCart(key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => updateCartQty(key, ci.quantity - 1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <CartQtyInput
                          value={ci.quantity}
                          onChange={(qty) => updateCartQty(key, qty)}
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => updateCartQty(key, ci.quantity + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </FadeIn>
            );
          })}
        </div>

        <Separator />

        {/* Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-body-sm text-muted-foreground px-1">
            <span>{t("cart.itemCount", { count: cart.size })}</span>
          </div>

          {/* Order-level discount */}
          <Card variant="glass" className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-body-sm font-semibold text-foreground">
                {t("cart.discount")}
              </span>
              {/* ₪ / % type toggle */}
              <div className="flex overflow-hidden rounded-lg border border-input">
                {(["fixed", "percent"] as DiscountType[]).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() =>
                      onDiscountChange({
                        type: tp,
                        value: discount?.value ?? 0,
                      })
                    }
                    className={
                      "px-3 py-1 text-body-sm font-bold transition " +
                      ((discount?.type ?? "fixed") === tp
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground")
                    }
                  >
                    {tp === "fixed" ? "₪" : "%"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                aria-label={t("cart.discount")}
                value={discount?.value ? String(discount.value) : ""}
                placeholder="0"
                onFocusCapture={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
                  const n = parseFloat(raw);
                  const type = discount?.type ?? "fixed";
                  if (!raw || !Number.isFinite(n) || n <= 0) {
                    onDiscountChange(null);
                  } else {
                    onDiscountChange({ type, value: n });
                  }
                }}
                className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-body-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {discountAmount > 0 && (
                <button
                  type="button"
                  onClick={() => onDiscountChange(null)}
                  className="shrink-0 rounded-lg px-2 py-1 text-caption font-semibold text-destructive"
                >
                  {t("actions.clear")}
                </button>
              )}
            </div>
          </Card>

          {/* Breakdown */}
          <div className="space-y-1.5 rounded-xl bg-background-subtle px-4 py-3">
            <div className="flex items-center justify-between text-body-sm text-muted-foreground">
              <span>{t("cart.subtotal")}</span>
              <span dir="ltr">{formatCurrency(cartTotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-body-sm text-success">
                <span>{t("cart.discount")}</span>
                <span dir="ltr">− {formatCurrency(discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between text-body font-bold text-foreground">
              <span>{t("order.total")}</span>
              <span className="text-primary" dir="ltr">
                {formatCurrency(finalTotal)}
              </span>
            </div>
          </div>

          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={onPlaceOrder}
          >
            <ShoppingCart className="h-5 w-5 me-2" />
            {t("cart.placeOrder")}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={onBrowse}
          >
            <Package className="h-4 w-4 me-2" />
            {t("cart.browseCatalog")}
          </Button>
        </div>
      </div>
    </FadeIn>
  );
}

/** Calculate auto delivery date based on customer's assigned day */
export function getAutoDeliveryDate(customerAssignedDay: string): Date {
  const today = new Date();
  const daysMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const customerDayNum = daysMap[customerAssignedDay];
  const todayNum = today.getDay();

  if (customerDayNum === todayNum) {
    return today;
  }

  // Calculate days until next occurrence
  let daysUntil = (customerDayNum - todayNum + 7) % 7;
  if (daysUntil === 0) daysUntil = 7;

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate;
}
