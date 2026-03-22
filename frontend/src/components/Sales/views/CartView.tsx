import { useMemo } from "react";
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
import { StatCard } from "@/components/ui/stat-card";
import { TopBar } from "@/components/ui/top-bar";
import { type Customer, type Product, type CartItem } from "@/services/salesApi";
import { getUnitPrice } from "@/lib/cart";
import { getCoverImage } from "@/lib/image";
import { formatCurrency } from "@/lib/format";
import { getProductName } from "@/lib/product";
import { CustomerSelector } from "./CustomerSelector";

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
}: CartViewProps) {
  const { t } = useTranslation();

  const cartEntries = useMemo(() => Array.from(cart.entries()), [cart]);

  const productName = (p: Product) => getProductName(p);

  if (cartEntries.length === 0) {
    return (
      <div className="animate-fade-in">
        <TopBar title={t("cart.title")} />
        <EmptyState
          icon={ShoppingCart}
          title={t("cart.empty")}
          description={t("cart.browseCatalog")}
          action={{ label: t("nav.catalog"), onClick: onBrowse }}
          className="py-16"
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
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
              <Card
                key={key}
                variant="glass"
                className="animate-slide-up overflow-hidden"
                style={{ animationDelay: `${idx * 40}ms` }}
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
                        <span className="min-w-[2rem] text-center text-body-sm font-bold text-foreground">
                          {ci.quantity}
                        </span>
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
            );
          })}
        </div>

        <Separator />

        {/* Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-body-sm text-muted-foreground px-1">
            <span>{t("cart.itemCount", { count: cart.size })}</span>
          </div>

          <StatCard
            variant="gradient"
            value={formatCurrency(cartTotal)}
            label={t("cart.subtotal")}
            icon={ShoppingCart}
          />

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
    </div>
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
